import type {
  CommentRecord,
  ReplyActionRecord,
  ReplyCandidate,
  ReplyPlanRecord,
  ReplyStrategy
} from "../../shared/types.js";
import { asRecord, createId, detectRiskSignal, nowIso, pickString } from "../../shared/utils.js";
import { store } from "../storage/runtimeStorage.js";
import { markAuthDisconnected } from "./authState.js";
import { redbook } from "./redbookService.js";

const MIN_REPLY_DELAY_MS = 180_000;
let lastReplyAt = 0;
let workerTimer: NodeJS.Timeout | undefined;
let activeReplyWork: Promise<void> | undefined;

export interface ReplyPlanInput {
  noteId: string;
  strategy: ReplyStrategy;
  max?: number;
  template?: string;
}

export async function createReplyPlan(input: ReplyPlanInput): Promise<ReplyPlanRecord> {
  const [notes, comments] = await Promise.all([store.read("notes"), store.read("comments")]);
  const note = notes.find((item) => item.id === input.noteId);
  if (!note) {
    throw new Error("Note not found.");
  }

  const related = comments.filter((comment) => comment.noteId === input.noteId);
  const max = Math.min(Math.max(Math.floor(input.max ?? 10), 1), 30);
  const selected = selectCandidates(related, input.strategy, max);
  const planId = createId("reply_plan");
  const now = nowIso();

  const candidates: ReplyCandidate[] = selected.map((comment) => {
    const actionId = createId("reply_action");
    return {
      id: createId("reply_candidate"),
      actionId,
      commentId: comment.id,
      noteId: note.id,
      author: comment.authorName,
      content: comment.content,
      likes: comment.likedCount,
      hasSubReplies: hasSubReplies(comment),
      isQuestion: isQuestion(comment.content),
      matchedStrategy: input.strategy,
      draft: buildDraft(input.template, comment, note.title)
    };
  });

  const actions: ReplyActionRecord[] = candidates.map((candidate) => ({
    id: candidate.actionId,
    planId,
    noteId: note.id,
    webUrl: note.webUrl,
    commentId: candidate.commentId,
    content: candidate.draft,
    status: "draft",
    createdAt: now,
    updatedAt: now
  }));

  const plan: ReplyPlanRecord = {
    id: planId,
    noteId: note.id,
    webUrl: note.webUrl,
    noteTitle: note.title,
    strategy: input.strategy,
    status: "draft",
    candidates,
    skipped: Math.max(0, related.length - candidates.length),
    totalComments: related.length,
    createdAt: now,
    updatedAt: now
  };

  await store.update("replyPlans", (plans) => [plan, ...plans]);
  await store.update("replyActions", (existing) => [...actions, ...existing]);
  return plan;
}

export async function listReplyPlans(): Promise<ReplyPlanRecord[]> {
  return store.read("replyPlans");
}

export async function listReplyActions(): Promise<ReplyActionRecord[]> {
  return store.read("replyActions");
}

export async function approveReplyAction(actionId: string, content?: string): Promise<ReplyActionRecord> {
  let approved: ReplyActionRecord | undefined;
  const now = nowIso();
  await store.update("replyActions", (actions) =>
    actions.map((action) => {
      if (action.id !== actionId) return action;
      approved = {
        ...action,
        content: content?.trim() || action.content,
        status: "queued",
        approvedAt: now,
        updatedAt: now
      };
      return approved;
    })
  );

  if (!approved) {
    throw new Error("Reply action not found.");
  }

  await store.update("replyPlans", (plans) =>
    plans.map((plan) => (plan.id === approved?.planId ? { ...plan, status: "queued", updatedAt: now } : plan))
  );
  return approved;
}

export function startReplyWorker(): void {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    if (activeReplyWork) return;
    const work = processReplyQueue().then(() => undefined, () => undefined);
    activeReplyWork = work;
    void work.finally(() => {
      if (activeReplyWork === work) activeReplyWork = undefined;
    });
  }, 30_000);
}

export async function stopReplyWorker(timeoutMs?: number): Promise<void> {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = undefined;
  }
  if (!activeReplyWork) return;
  if (timeoutMs === undefined) {
    await activeReplyWork;
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      activeReplyWork,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`等待回复任务停止超时（${Math.max(0, timeoutMs)}ms），请稍后重试数据恢复。`)),
          Math.max(0, timeoutMs)
        );
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function processReplyQueue(): Promise<ReplyActionRecord | undefined> {
  if (Date.now() - lastReplyAt < MIN_REPLY_DELAY_MS) {
    return undefined;
  }

  const actions = await store.read("replyActions");
  const next = actions
    .filter((action) => action.status === "queued")
    .sort((a, b) => (a.approvedAt ?? a.createdAt).localeCompare(b.approvedAt ?? b.createdAt))[0];
  if (!next) {
    return undefined;
  }

  await patchAction(next.id, { status: "sending", updatedAt: nowIso() });
  try {
    await redbook.reply(next.webUrl, next.commentId, next.content);
    lastReplyAt = Date.now();
    const sent = await patchAction(next.id, { status: "sent", sentAt: nowIso(), updatedAt: nowIso(), error: undefined });
    await refreshPlanStatus(next.planId);
    return sent;
  } catch (error) {
    const risk = detectRiskSignal(error);
    const failed = await patchAction(next.id, {
      status: risk ? "paused" : "failed",
      error: error instanceof Error ? error.message : String(error),
      updatedAt: nowIso()
    });
    if (risk) {
      await markAuthDisconnected(risk);
      await pauseQueuedReplies(risk);
    }
    await refreshPlanStatus(next.planId);
    return failed;
  }
}

function selectCandidates(comments: CommentRecord[], strategy: ReplyStrategy, max: number): CommentRecord[] {
  const ranked = [...comments];
  if (strategy === "questions") {
    return ranked
      .filter((comment) => isQuestion(comment.content))
      .sort((a, b) => b.likedCount - a.likedCount)
      .slice(0, max);
  }
  if (strategy === "top-engaged") {
    return ranked.sort((a, b) => b.likedCount - a.likedCount).slice(0, max);
  }
  return ranked
    .filter((comment) => !hasSubReplies(comment))
    .sort((a, b) => b.likedCount - a.likedCount)
    .slice(0, max);
}

function buildDraft(template: string | undefined, comment: CommentRecord, noteTitle: string): string {
  const author = comment.authorName ?? "朋友";
  if (template?.trim()) {
    return template
      .replaceAll("{author}", author)
      .replaceAll("{content}", comment.content)
      .replaceAll("{noteTitle}", noteTitle);
  }
  if (isQuestion(comment.content)) {
    return `@${author} 这个问题我补充一下：可以先看正文里的关键步骤，我后面也会整理更完整的清单。`;
  }
  return `@${author} 谢谢你的反馈，这个点很有参考价值，我会继续补充。`;
}

function isQuestion(content: string): boolean {
  return /[?？吗呢咋哪如何怎么为什么]/.test(content);
}

function hasSubReplies(comment: CommentRecord): boolean {
  const raw = asRecord(comment.raw);
  const count = Number(raw.sub_comment_count ?? raw.subCommentCount ?? raw.sub_comment_cnt ?? 0);
  const replies = raw.sub_comments ?? raw.subComments;
  return count > 0 || (Array.isArray(replies) && replies.length > 0) || Boolean(pickString(raw.reply_id, raw.replyId));
}

async function patchAction(id: string, patch: Partial<ReplyActionRecord>): Promise<ReplyActionRecord> {
  let updated: ReplyActionRecord | undefined;
  await store.update("replyActions", (actions) =>
    actions.map((action) => {
      if (action.id !== id) return action;
      updated = { ...action, ...patch };
      return updated;
    })
  );
  if (!updated) {
    throw new Error("Reply action not found.");
  }
  return updated;
}

async function pauseQueuedReplies(reason: string): Promise<void> {
  await store.update("replyActions", (actions) =>
    actions.map((action) =>
      action.status === "queued" || action.status === "sending"
        ? { ...action, status: "paused", error: reason, updatedAt: nowIso() }
        : action
    )
  );
}

async function refreshPlanStatus(planId: string): Promise<void> {
  const actions = (await store.read("replyActions")).filter((action) => action.planId === planId);
  const status = actions.some((action) => action.status === "paused")
    ? "paused"
    : actions.some((action) => action.status === "queued" || action.status === "sending")
      ? "sending"
      : actions.every((action) => action.status === "sent")
        ? "completed"
        : actions.some((action) => action.status === "failed")
          ? "failed"
          : "draft";
  await store.update("replyPlans", (plans) =>
    plans.map((plan) => (plan.id === planId ? { ...plan, status, updatedAt: nowIso() } : plan))
  );
}
