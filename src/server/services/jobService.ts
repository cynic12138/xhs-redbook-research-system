import type {
  AnalyticsReport,
  AuthorPostRecord,
  AuthorRecord,
  CommentRecord,
  NoteRecord,
  QueueKind,
  QueueKindProgress,
  QueueItem,
  SearchJob,
  SearchJobInput
} from "../../shared/types.js";
import { clamp, createId, detectRiskSignal, nowIso } from "../../shared/utils.js";
import {
  getDailyReadBudget,
  getDetailIntervalSec,
  getDetailJitterPct,
  getJobConcurrency,
  getMaxJobConcurrency,
  getSearchIntervalSec,
  getSearchJitterPct,
  getWorkerStaggerSec
} from "../utils/env.js";
import { store } from "../storage/runtimeStorage.js";
import { buildAnalytics, analyzeNote } from "./analysis.js";
import { markAuthDisconnected } from "./authState.js";
import { normalizeAuthor, normalizeAuthorPosts, normalizeComments, normalizeNote, normalizeSearchResults } from "./normalizers.js";
import { redbook } from "./redbookService.js";

const activeTimers = new Map<string, Set<NodeJS.Timeout>>();
const activeWorkers = new Map<string, number>();
const queueKinds: QueueKind[] = ["read", "comments", "user", "user-posts", "analyze"];
const shutdownPauseReason = "应用退出时已安全暂停，可在下次启动后恢复。";

function reportJobBackgroundError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[job:${scope}] ${message}`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class JobService {
  private shuttingDown = false;

  async createJob(input: SearchJobInput): Promise<SearchJob> {
    this.assertAcceptingWork();
    const job: SearchJob = {
      id: createId("job"),
      keywords: input.keywords.map((keyword) => keyword.trim()).filter(Boolean),
      sort: input.sort,
      noteType: input.noteType,
      pages: clamp(Math.floor(input.pages || 1), 1, 10),
      commentPages: clamp(Math.floor(input.commentPages || 1), 1, 2),
      concurrency: normalizeConcurrency(input.concurrency),
      status: "running",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      startedAt: nowIso(),
      progress: {
        seeded: 0,
        pending: 0,
        running: 0,
        done: 0,
        error: 0,
        total: 0,
        byKind: emptyKindProgress()
      }
    };

    await store.update("searchJobs", (jobs) => [...jobs, job]);

    try {
      await this.seedJob(job);
      await this.refreshProgress(job.id);
      this.start(job.id);
    } catch (error) {
      await this.failJob(job.id, error instanceof Error ? error.message : String(error));
    }

    return this.getJob(job.id) as Promise<SearchJob>;
  }

  async getJob(jobId: string): Promise<SearchJob | undefined> {
    const jobs = await this.listJobs();
    return jobs.find((job) => job.id === jobId);
  }

  async listJobs(): Promise<SearchJob[]> {
    await this.requeueStoppedRunningItems();
    const [jobs, items, notes] = await Promise.all([
      store.read("searchJobs"),
      store.read("queueItems"),
      store.read("notes")
    ]);
    return jobs.map((job) => ({
      ...job,
      progress: this.buildProgress(job.id, items, notes)
    }));
  }

  async resume(jobId: string): Promise<SearchJob | undefined> {
    this.assertAcceptingWork();
    await this.requeueRunningItems(jobId);
    await this.requeueRecoverableAuthorItems(jobId);
    await this.requeueTransientStorageItems(jobId);
    await store.update("searchJobs", (jobs) =>
      jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "running",
              breakerReason: undefined,
              updatedAt: nowIso()
            }
          : job
      )
    );
    this.start(jobId);
    return this.getJob(jobId);
  }

  async stop(jobId: string): Promise<SearchJob | undefined> {
    this.clearTimers(jobId);
    await this.requeueRunningItems(jobId);
    await this.pauseJob(jobId, "用户手动停止。");
    return this.getJob(jobId);
  }

  start(jobId: string, delayMs = 0): void {
    if (this.shuttingDown) {
      return;
    }
    void this.ensureWorkers(jobId, delayMs).catch((error) => reportJobBackgroundError("ensureWorkers", error));
  }

  private async ensureWorkers(jobId: string, delayMs = 0): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    const job = await this.getJob(jobId);
    if (!job || job.status !== "running") {
      return;
    }

    const target = normalizeConcurrency(job.concurrency);
    const active = activeWorkers.get(jobId) ?? 0;
    const scheduled = activeTimers.get(jobId)?.size ?? 0;
    let slot = 0;
    for (let index = active + scheduled; index < target; index += 1) {
      this.scheduleWorker(jobId, delayMs + (slot === 0 ? 0 : this.nextWorkerStaggerMs()));
      slot += 1;
    }
  }

  private scheduleWorker(jobId: string, delayMs: number): void {
    if (this.shuttingDown) {
      return;
    }
    const timer = setTimeout(() => {
      const timers = activeTimers.get(jobId);
      timers?.delete(timer);
      if (!timers?.size) {
        activeTimers.delete(jobId);
      }
      void this.runWorker(jobId).catch((error) => reportJobBackgroundError("runWorker", error));
    }, delayMs);
    const timers = activeTimers.get(jobId) ?? new Set<NodeJS.Timeout>();
    timers.add(timer);
    activeTimers.set(jobId, timers);
  }

  private async runWorker(jobId: string): Promise<void> {
    activeWorkers.set(jobId, (activeWorkers.get(jobId) ?? 0) + 1);
    let shouldContinue = false;
    try {
      shouldContinue = await this.processNext(jobId);
    } catch (error) {
      const reason = errorMessage(error);
      reportJobBackgroundError(`processNext:${jobId}`, error);
      await this.pauseJob(jobId, reason).catch((pauseError) => reportJobBackgroundError(`pauseJob:${jobId}`, pauseError));
      shouldContinue = false;
    } finally {
      const nextCount = Math.max(0, (activeWorkers.get(jobId) ?? 1) - 1);
      if (nextCount) {
        activeWorkers.set(jobId, nextCount);
      } else {
        activeWorkers.delete(jobId);
      }
    }
    if (shouldContinue) {
      this.start(jobId, this.nextDelayMs());
    }
  }

  async resumeActiveJobs(): Promise<void> {
    const jobs = await store.read("searchJobs");
    const runningIds = new Set(jobs.filter((item) => item.status === "running").map((item) => item.id));
    await store.update("queueItems", (items) =>
      items.map((item) =>
        runningIds.has(item.jobId) && item.status === "running"
          ? {
              ...item,
              status: "pending",
              updatedAt: nowIso()
            }
          : item
      )
    );
    for (const job of jobs.filter((item) => item.status === "running")) {
      this.start(job.id, 1000);
    }
  }

  async pauseActiveJobsOnStartup(): Promise<void> {
    const jobs = await store.read("searchJobs");
    const runningIds = new Set(jobs.filter((item) => item.status === "running").map((item) => item.id));
    if (!runningIds.size) {
      return;
    }

    await store.update("queueItems", (items) =>
      items.map((item) =>
        runningIds.has(item.jobId) && item.status === "running"
          ? {
              ...item,
              status: "pending",
              updatedAt: nowIso()
            }
          : item
      )
    );
    await store.update("searchJobs", (items) =>
      items.map((job) =>
        runningIds.has(job.id)
          ? {
              ...job,
              status: "paused",
              breakerReason: "服务启动后已暂停历史运行任务，请手动恢复。",
              updatedAt: nowIso()
            }
          : job
      )
    );
  }

  async hasRunningJobs(): Promise<boolean> {
    if ([...activeWorkers.values()].some((count) => count > 0) || [...activeTimers.values()].some((timers) => timers.size > 0)) {
      return true;
    }
    const currentJobs = await store.read("searchJobs");
    return currentJobs.some((job) => job.status === "running");
  }

  async prepareForShutdown(timeoutMs = 15_000): Promise<void> {
    this.shuttingDown = true;
    for (const jobId of [...activeTimers.keys()]) {
      this.clearTimers(jobId);
    }

    const workersStopped = await this.waitForActiveWorkers(Math.max(0, timeoutMs));
    await store.update("queueItems", (items) =>
      items.map((item) =>
        item.status === "running"
          ? {
              ...item,
              status: "pending",
              updatedAt: nowIso()
            }
          : item
      )
    );

    const [queueItems, notes] = await Promise.all([store.read("queueItems"), store.read("notes")]);
    await store.update("searchJobs", (currentJobs) =>
      currentJobs.map((job) =>
        job.status === "running"
          ? {
              ...job,
              status: "paused",
              breakerReason: shutdownPauseReason,
              progress: this.buildProgress(job.id, queueItems, notes),
              updatedAt: nowIso()
            }
          : job
      )
    );

    if (!workersStopped) {
      throw new Error(`等待后台任务停止超时（${Math.max(0, timeoutMs)}ms），任务状态已安全保存。`);
    }
  }

  private async seedJob(job: SearchJob): Promise<void> {
    let searched = false;
    for (const keyword of job.keywords) {
      for (let page = 1; page <= job.pages; page += 1) {
        if (searched) {
          await sleep(this.nextSearchDelayMs());
        }
        const raw = await redbook.search(keyword, page, job.sort, job.noteType);
        searched = true;
        const notes = normalizeSearchResults(raw, keyword, job.id);
        await this.upsertNotes(notes);
        await this.seedQueue(job, notes, keyword);
      }
    }
  }

  private async seedQueue(job: SearchJob, notes: NoteRecord[], keyword: string): Promise<void> {
    const newItems: QueueItem[] = [];
    const seenAuthors = new Set<string>();
    for (const note of notes) {
      newItems.push(this.queueItem(job.id, "read", note.webUrl, { noteId: note.id, keyword }));
      newItems.push(this.queueItem(job.id, "comments", note.webUrl, { noteId: note.id, keyword }));
      if (note.authorId && !seenAuthors.has(note.authorId)) {
        seenAuthors.add(note.authorId);
        newItems.push(this.queueItem(job.id, "user", note.authorId, { userId: note.authorId, keyword }));
        newItems.push(this.queueItem(job.id, "user-posts", note.authorId, { userId: note.authorId, keyword }));
      }
      newItems.push(this.queueItem(job.id, "analyze", note.id, { noteId: note.id, keyword }));
    }

    await store.update("queueItems", (items) => {
      const existingKeys = new Set(items.map((item) => `${item.jobId}:${item.kind}:${item.arg}`));
      const uniqueItems = newItems.filter((item) => !existingKeys.has(`${item.jobId}:${item.kind}:${item.arg}`));
      return [...items, ...uniqueItems];
    });
  }

  private queueItem(
    jobId: string,
    kind: QueueItem["kind"],
    arg: string,
    extra: Partial<Pick<QueueItem, "noteId" | "userId" | "keyword">>
  ): QueueItem {
    return {
      id: createId("queue"),
      jobId,
      kind,
      arg,
      status: "pending",
      attempts: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...extra
    };
  }

  private async processNext(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job || job.status !== "running") {
      return false;
    }

    const next = await this.claimNextQueueItem(jobId);
    if (!next) {
      await this.completeIfDone(jobId);
      return false;
    }

    if (shouldConsumeBudget(next.kind)) {
      const budgetReady = await this.consumeBudgetSlot();
      if (!budgetReady.ok) {
        await this.markQueueItem(next.id, { status: "pending" });
        await this.pauseJob(jobId, budgetReady.reason);
        return false;
      }
    }

    try {
      const result = await this.processItem(next, job.commentPages);
      const risk = detectRiskSignal(result);
      if (risk) {
        if (await this.shouldSkipRisk(next, risk)) {
          await this.markQueueItem(next.id, { status: "error", error: risk });
          await this.refreshProgress(jobId);
          return true;
        }
        await this.markQueueItem(next.id, { status: "pending", error: risk });
        await this.pauseJob(jobId, risk);
        return false;
      }
      await this.markQueueItem(next.id, { status: "done", error: undefined });
      await this.refreshProgress(jobId);
      return true;
    } catch (error) {
      const reason = detectRiskSignal(error) ?? (error instanceof Error ? error.message : String(error));
      const isRisk = Boolean(detectRiskSignal(error));
      if (isRisk && (await this.shouldSkipRisk(next, reason))) {
        await this.markQueueItem(next.id, { status: "error", error: reason });
        await this.refreshProgress(jobId);
        return true;
      }
      await this.markQueueItem(next.id, { status: isRisk ? "pending" : "error", error: reason });
      if (isRisk) {
        await this.pauseJob(jobId, reason);
        return false;
      }
      await this.refreshProgress(jobId);
      return true;
    }
  }

  private async requeueRecoverableAuthorItems(jobId: string): Promise<void> {
    await store.update("queueItems", (items) =>
      items.map((item) =>
        item.jobId === jobId &&
        item.status === "error" &&
        (item.kind === "user" || item.kind === "user-posts") &&
        item.error?.includes('"code":-1')
          ? {
              ...item,
              status: "pending",
              error: undefined,
              updatedAt: nowIso()
            }
          : item
      )
    );
  }

  private async requeueTransientStorageItems(jobId: string): Promise<void> {
    await store.update("queueItems", (items) =>
      items.map((item) =>
        item.jobId === jobId &&
        item.status === "error" &&
        item.error?.includes("EPERM: operation not permitted, rename")
          ? {
              ...item,
              status: "pending",
              error: undefined,
              updatedAt: nowIso()
            }
          : item
      )
    );
  }

  private async processItem(item: QueueItem, commentPages: number): Promise<unknown> {
    if (item.kind === "read") {
      const raw = await redbook.read(item.arg);
      const notes = await store.read("notes");
      const existing = notes.find((note) => note.id === item.noteId);
      const normalized = normalizeNote(raw, item.keyword ?? "", item.jobId, existing);
      if (normalized) {
        await this.upsertNotes([normalized]);
      }
      return raw;
    }

    if (item.kind === "comments" && item.noteId) {
      const raw = await redbook.comments(item.arg, commentPages);
      const normalized = normalizeComments(raw, item.noteId);
      await this.upsertComments(normalized);
      return raw;
    }

    if (item.kind === "user" && item.userId) {
      const raw = await redbook.user(item.userId);
      await this.upsertAuthors([normalizeAuthor(raw, item.userId)]);
      return raw;
    }

    if (item.kind === "user-posts" && item.userId) {
      const raw = await redbook.userPosts(item.userId);
      await this.upsertAuthorPosts(normalizeAuthorPosts(raw, item.userId));
      return raw;
    }

    if (item.kind === "analyze" && item.noteId) {
      await this.analyzeStoredNote(item.noteId);
      return { ok: true };
    }

    return { ok: true };
  }

  private async analyzeStoredNote(noteId: string): Promise<void> {
    const [notes, comments, authorPosts] = await Promise.all([
      store.read("notes"),
      store.read("comments"),
      store.read("authorPosts")
    ]);
    const note = notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }

    const analysis = analyzeNote(
      note,
      comments.filter((comment) => comment.noteId === noteId),
      authorPosts.filter((post) => post.authorId === note.authorId)
    );
    const nextNote = {
      ...note,
      analysis,
      updatedAt: nowIso()
    };
    await this.upsertNotes([nextNote]);
    await this.rebuildReportsForNote(nextNote);
  }

  private async rebuildReportsForNote(note: NoteRecord): Promise<void> {
    const [notes, authors, authorPosts] = await Promise.all([
      store.read("notes"),
      store.read("authors"),
      store.read("authorPosts")
    ]);
    const reports = await store.read("analysisReports");
    const nextReports = [...reports];
    for (const jobId of note.jobIds) {
      const report = buildAnalytics(jobId, notes, authors, authorPosts);
      const index = nextReports.findIndex((item) => item.jobId === jobId);
      if (index >= 0) {
        nextReports[index] = report;
      } else {
        nextReports.push(report);
      }
    }
    await store.write("analysisReports", nextReports);
  }

  private async upsertNotes(incoming: NoteRecord[]): Promise<void> {
    if (!incoming.length) {
      return;
    }
    await store.update("notes", (notes) => {
      const byId = new Map(notes.map((note) => [note.id, note]));
      for (const note of incoming) {
        byId.set(note.id, { ...(byId.get(note.id) ?? note), ...note });
      }
      return [...byId.values()];
    });
  }

  private async upsertComments(incoming: CommentRecord[]): Promise<void> {
    if (!incoming.length) {
      return;
    }
    await store.update("comments", (comments) => {
      const byId = new Map(comments.map((comment) => [comment.id, comment]));
      for (const comment of incoming) {
        byId.set(comment.id, { ...(byId.get(comment.id) ?? comment), ...comment });
      }
      return [...byId.values()];
    });
  }

  private async upsertAuthors(incoming: AuthorRecord[]): Promise<void> {
    if (!incoming.length) {
      return;
    }
    await store.update("authors", (authors) => {
      const byId = new Map(authors.map((author) => [author.id, author]));
      for (const author of incoming) {
        byId.set(author.id, { ...(byId.get(author.id) ?? author), ...author });
      }
      return [...byId.values()];
    });
  }

  private async upsertAuthorPosts(incoming: AuthorPostRecord[]): Promise<void> {
    if (!incoming.length) {
      return;
    }
    await store.update("authorPosts", (posts) => {
      const byId = new Map(posts.map((post) => [`${post.authorId}:${post.id}`, post]));
      for (const post of incoming) {
        byId.set(`${post.authorId}:${post.id}`, { ...(byId.get(`${post.authorId}:${post.id}`) ?? post), ...post });
      }
      return [...byId.values()];
    });
  }

  private async markQueueItem(id: string, patch: Partial<QueueItem>): Promise<void> {
    await store.update("queueItems", (items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              updatedAt: nowIso()
            }
          : item
      )
    );
  }

  private async claimNextQueueItem(jobId: string): Promise<QueueItem | undefined> {
    let claimed: QueueItem | undefined;
    await store.update("queueItems", (items) => {
      const index = items.findIndex((item) => item.jobId === jobId && item.status === "pending");
      if (index < 0) {
        return items;
      }
      const next: QueueItem = {
        ...items[index],
        status: "running",
        attempts: items[index].attempts + 1,
        updatedAt: nowIso()
      };
      claimed = next;
      const updated = [...items];
      updated[index] = next;
      return updated;
    });
    await this.refreshProgress(jobId);
    return claimed;
  }

  private async requeueRunningItems(jobId: string): Promise<void> {
    await store.update("queueItems", (items) =>
      items.map((item) =>
        item.jobId === jobId && item.status === "running"
          ? {
              ...item,
              status: "pending",
              updatedAt: nowIso()
            }
          : item
      )
    );
    await this.refreshProgress(jobId);
  }

  private async shouldSkipRisk(item: QueueItem, reason: string): Promise<boolean> {
    if (!reason.includes("Empty response")) {
      return false;
    }
    if (item.kind !== "read" && item.kind !== "comments") {
      return false;
    }
    if (item.noteId && !isLikelyNoteId(item.noteId)) {
      return true;
    }
    const notes = await store.read("notes");
    const note = notes.find((candidate) => candidate.id === item.noteId);
    if (!note) {
      return false;
    }
    const raw = note.raw && typeof note.raw === "object" ? (note.raw as Record<string, unknown>) : {};
    const modelType = raw.model_type ?? raw.modelType;
    return modelType !== undefined && modelType !== "note" && !raw.note_card && !raw.noteCard;
  }

  private async pauseJob(jobId: string, reason: string): Promise<void> {
    this.clearTimers(jobId);
    await markAuthDisconnected(reason);
    await store.update("searchJobs", (jobs) =>
      jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "paused",
              breakerReason: reason,
              updatedAt: nowIso()
            }
          : job
      )
    );
    await this.refreshProgress(jobId);
  }

  private async failJob(jobId: string, reason: string): Promise<void> {
    this.clearTimers(jobId);
    await markAuthDisconnected(reason);
    await store.update("searchJobs", (jobs) =>
      jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: "failed",
              breakerReason: reason,
              updatedAt: nowIso()
            }
          : job
      )
    );
  }

  private async completeIfDone(jobId: string): Promise<void> {
    const items = await store.read("queueItems");
    const hasOpen = items.some((item) => item.jobId === jobId && (item.status === "pending" || item.status === "running"));
    if (!hasOpen) {
      const [notes, authors, authorPosts] = await Promise.all([
        store.read("notes"),
        store.read("authors"),
        store.read("authorPosts")
      ]);
      await this.upsertReport(buildAnalytics(jobId, notes, authors, authorPosts));
      await store.update("searchJobs", (jobs) =>
        jobs.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: "completed",
                completedAt: nowIso(),
                updatedAt: nowIso()
              }
            : job
        )
      );
      this.clearTimers(jobId);
    }
    await this.refreshProgress(jobId);
  }

  private async upsertReport(report: AnalyticsReport): Promise<void> {
    await store.update("analysisReports", (reports) => {
      const index = reports.findIndex((item) => item.jobId === report.jobId);
      if (index >= 0) {
        const next = [...reports];
        next[index] = report;
        return next;
      }
      return [...reports, report];
    });
  }

  async refreshProgress(jobId: string): Promise<void> {
    const [items, notes] = await Promise.all([store.read("queueItems"), store.read("notes")]);
    const progress = this.buildProgress(jobId, items, notes);
    await store.update("searchJobs", (jobs) =>
      jobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              progress,
              updatedAt: nowIso()
            }
          : job
      )
    );
  }

  private buildProgress(jobId: string, items: QueueItem[], notes: NoteRecord[]): SearchJob["progress"] {
    const jobItems = items.filter((item) => item.jobId === jobId);
    const byKind = emptyKindProgress();
    for (const item of jobItems) {
      const bucket = byKind[item.kind];
      bucket[item.status] += 1;
      bucket.total += 1;
    }
    return {
      seeded: notes.filter((note) => note.jobIds.includes(jobId)).length,
      pending: jobItems.filter((item) => item.status === "pending").length,
      running: jobItems.filter((item) => item.status === "running").length,
      done: jobItems.filter((item) => item.status === "done").length,
      error: jobItems.filter((item) => item.status === "error").length,
      total: jobItems.length,
      byKind
    };
  }

  private async requeueStoppedRunningItems(): Promise<void> {
    const jobs = await store.read("searchJobs");
    const runningJobs = new Set(jobs.filter((job) => job.status === "running").map((job) => job.id));
    let changed = false;
    await store.update("queueItems", (items) => {
      const next = items.map((item) => {
        if (item.status !== "running" || runningJobs.has(item.jobId)) {
          return item;
        }
        changed = true;
        return {
          ...item,
          status: "pending" as const,
          updatedAt: nowIso()
        };
      });
      return changed ? next : items;
    });
  }

  private async consumeBudgetSlot(): Promise<{ ok: true } | { ok: false; reason: string }> {
    const budget = getDailyReadBudget();
    if (budget <= 0) {
      return { ok: true };
    }
    const today = new Date().toISOString().slice(0, 10);
    let result: { ok: true } | { ok: false; reason: string } = { ok: true };
    await store.update("rateLimit", (state) => {
      const next = state.budgetDate === today ? { ...state } : { budgetDate: today, consumedToday: 0 };
      if (next.consumedToday >= budget) {
        result = { ok: false, reason: `今日小红书读取额度已达上限（${budget}）。可明天继续，或在 .env.local 调整 XHS_DAILY_READ_BUDGET 后重启。` };
        return next;
      }
      next.consumedToday += 1;
      return next;
    });
    return result;
  }

  private nextDelayMs(): number {
    return randomDelayMs(getDetailIntervalSec(), getDetailJitterPct(), 5);
  }

  private nextSearchDelayMs(): number {
    return randomDelayMs(getSearchIntervalSec(), getSearchJitterPct(), 3);
  }

  private nextWorkerStaggerMs(): number {
    return randomDelayMs(getWorkerStaggerSec(), getDetailJitterPct(), 3);
  }

  private clearTimers(jobId: string): void {
    const timers = activeTimers.get(jobId);
    if (!timers) {
      return;
    }
    for (const timer of timers) {
      clearTimeout(timer);
    }
    activeTimers.delete(jobId);
  }

  private async waitForActiveWorkers(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while ([...activeWorkers.values()].some((count) => count > 0)) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return false;
      }
      await sleep(Math.min(50, remaining));
    }
    return true;
  }

  private assertAcceptingWork(): void {
    if (this.shuttingDown) {
      throw new Error("应用正在退出，暂时不能启动新的抓取任务。");
    }
  }
}

export const jobs = new JobService();

function randomDelayMs(intervalSec: number, jitterPct: number, minSec: number): number {
  const interval = Math.max(minSec, intervalSec);
  const jitter = Math.max(0, jitterPct) / 100;
  const low = interval * (1 - jitter);
  const high = interval * (1 + jitter);
  const seconds = low + Math.random() * Math.max(0, high - low);
  return Math.max(minSec * 1000, Math.round(seconds * 1000));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyNoteId(value: string): boolean {
  return /^[0-9a-f]{24}$/i.test(value);
}

function normalizeConcurrency(value: unknown): number {
  return clamp(Math.floor(Number(value) || getJobConcurrency()), 1, getMaxJobConcurrency());
}

function emptyKindProgress(): Record<QueueKind, QueueKindProgress> {
  return Object.fromEntries(
    queueKinds.map((kind) => [kind, { pending: 0, running: 0, done: 0, error: 0, total: 0 }])
  ) as Record<QueueKind, QueueKindProgress>;
}

function shouldConsumeBudget(kind: QueueKind): boolean {
  return kind !== "analyze";
}
