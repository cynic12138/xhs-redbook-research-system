import type { AnalyticsReport, NotesPageResult, NotesQuery, NoteRecord } from "../../shared/types.js";
import { clamp, nowIso } from "../../shared/utils.js";
import { buildAnalytics } from "./analysis.js";
import { jobs } from "./jobService.js";
import { store } from "../storage/localStore.js";

export async function listNotes(query: NotesQuery): Promise<NoteRecord[]> {
  const notes = await store.read("notes");
  const q = query.q?.trim().toLowerCase();
  const author = query.author?.trim().toLowerCase();
  const minLikes = Number(query.minLikes ?? 0);

  const filtered = notes.filter((note) => {
    if (query.jobId && !note.jobIds.includes(query.jobId)) return false;
    if (query.type && query.type !== "all") {
      if (query.type === "image" && note.type !== "normal") return false;
      if (query.type === "video" && note.type !== "video") return false;
    }
    if (minLikes && note.likedCount < minLikes) return false;
    if (author && !(note.authorName ?? "").toLowerCase().includes(author)) return false;
    if (q) {
      const haystack = `${note.title} ${note.desc} ${note.authorName ?? ""} ${note.keywords.join(" ")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (query.sort === "likes") return b.likedCount - a.likedCount;
    if (query.sort === "comments") return b.commentCount - a.commentCount;
    if (query.sort === "collects") return b.collectedCount - a.collectedCount;
    if (query.sort === "latest") return (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt);
    return b.hotScore - a.hotScore;
  });
}

export async function listNotesPage(query: NotesQuery, page = 1, pageSize = 20): Promise<NotesPageResult> {
  const sorted = await listNotes(query);
  const safePageSize = clamp(Math.floor(pageSize || 20), 5, 100);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = clamp(Math.floor(page || 1), 1, totalPages);
  const start = (safePage - 1) * safePageSize;
  return {
    items: sorted.slice(start, start + safePageSize),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages
  };
}

export async function getNoteDetail(noteId: string): Promise<unknown> {
  const [notes, comments, authors, authorPosts] = await Promise.all([
    store.read("notes"),
    store.read("comments"),
    store.read("authors"),
    store.read("authorPosts")
  ]);
  const note = notes.find((item) => item.id === noteId);
  if (!note) {
    return undefined;
  }
  return {
    note,
    comments: comments.filter((comment) => comment.noteId === noteId).sort((a, b) => b.likedCount - a.likedCount),
    author: note.authorId ? authors.find((author) => author.id === note.authorId) : undefined,
    authorPosts: note.authorId ? authorPosts.filter((post) => post.authorId === note.authorId) : []
  };
}

export async function deleteNote(noteId: string): Promise<{ deleted: number }> {
  const notes = await store.read("notes");
  const target = notes.find((note) => note.id === noteId);
  if (!target) {
    return { deleted: 0 };
  }

  await store.update("notes", (items) => items.filter((note) => note.id !== noteId));
  await store.update("comments", (comments) => comments.filter((comment) => comment.noteId !== noteId));
  await store.update("queueItems", (items) => items.filter((item) => item.noteId !== noteId));
  await store.update("analysisReports", (reports) => reports.filter((report) => !target.jobIds.includes(report.jobId)));
  await Promise.all(target.jobIds.map((jobId) => jobs.refreshProgress(jobId)));
  return { deleted: 1 };
}

export async function clearNotes(jobId?: string): Promise<{ deleted: number }> {
  const notes = await store.read("notes");
  const affected = jobId ? notes.filter((note) => note.jobIds.includes(jobId)) : notes;
  const affectedIds = new Set(affected.map((note) => note.id));

  let deletedIds = new Set<string>();
  if (jobId) {
    await store.update("notes", (items) =>
      items
        .map((note) =>
          note.jobIds.includes(jobId)
            ? {
                ...note,
                jobIds: note.jobIds.filter((id) => id !== jobId),
                updatedAt: nowIso()
              }
            : note
        )
        .filter((note) => note.jobIds.length)
    );
    const remaining = await store.read("notes");
    const remainingIds = new Set(remaining.map((note) => note.id));
    deletedIds = new Set([...affectedIds].filter((id) => !remainingIds.has(id)));
    await store.update("queueItems", (items) => items.filter((item) => item.jobId !== jobId));
    await store.update("analysisReports", (reports) => reports.filter((report) => report.jobId !== jobId));
    await jobs.refreshProgress(jobId);
  } else {
    deletedIds = affectedIds;
    await store.write("notes", []);
    await store.write("comments", []);
    await store.write("queueItems", []);
    await store.write("analysisReports", []);
    const allJobs = await store.read("searchJobs");
    await Promise.all(allJobs.map((job) => jobs.refreshProgress(job.id)));
  }

  if (deletedIds.size) {
    await store.update("comments", (comments) => comments.filter((comment) => !deletedIds.has(comment.noteId)));
  }

  return { deleted: affected.length };
}

export async function getAnalytics(jobId: string): Promise<AnalyticsReport> {
  const [reports, notes, authors, authorPosts] = await Promise.all([
    store.read("analysisReports"),
    store.read("notes"),
    store.read("authors"),
    store.read("authorPosts")
  ]);
  return reports.find((report) => report.jobId === jobId) ?? buildAnalytics(jobId, notes, authors, authorPosts);
}

export async function buildExport(jobId: string, format: "json" | "csv" | "html"): Promise<{ body: string; type: string; name: string }> {
  const [job, notes, analytics] = await Promise.all([
    store.read("searchJobs").then((jobs) => jobs.find((item) => item.id === jobId)),
    listNotes({ jobId, sort: "hot" }),
    getAnalytics(jobId)
  ]);

  if (format === "csv") {
    const rows = [
      ["标题", "作者", "类型", "点赞", "收藏", "评论", "分享", "热度分", "关键词", "原帖"],
      ...notes.map((note) => [
        note.title,
        note.authorName ?? "",
        note.type,
        String(note.likedCount),
        String(note.collectedCount),
        String(note.commentCount),
        String(note.shareCount),
        String(note.hotScore),
        note.keywords.join("|"),
        note.webUrl
      ])
    ];
    return {
      body: rows.map((row) => row.map(csvCell).join(",")).join("\n"),
      type: "text/csv; charset=utf-8",
      name: `${jobId}.csv`
    };
  }

  if (format === "html") {
    return {
      body: renderHtmlReport(job?.keywords.join(" / ") ?? jobId, analytics, notes),
      type: "text/html; charset=utf-8",
      name: `${jobId}.html`
    };
  }

  return {
    body: JSON.stringify({ job, analytics, notes }, null, 2),
    type: "application/json; charset=utf-8",
    name: `${jobId}.json`
  };
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function renderHtmlReport(title: string, analytics: AnalyticsReport, notes: NoteRecord[]): string {
  const metric = analytics.overview;
  const noteRows = notes
    .slice(0, 100)
    .map(
      (note, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><a href="${escapeHtml(note.webUrl)}">${escapeHtml(note.title)}</a></td>
          <td>${escapeHtml(note.authorName ?? "")}</td>
          <td>${note.type}</td>
          <td>${note.likedCount}</td>
          <td>${note.collectedCount}</td>
          <td>${note.commentCount}</td>
          <td>${note.hotScore}</td>
        </tr>`
    )
    .join("");

  const keywordRows = analytics.keywords
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.keyword)}</td>
          <td>${item.tier}</td>
          <td>${item.top1Likes}</td>
          <td>${item.top10AvgLikes}</td>
          <td>${Math.round(item.collectLikeRatio * 100)}%</td>
          <td>${item.opportunityScore}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - 小红书分析报告</title>
  <style>
    body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; color: #1f2937; background: #f7f7fb; }
    header { padding: 28px 36px; background: #ff3b68; color: white; }
    main { padding: 28px 36px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin-top: 30px; font-size: 20px; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .metric { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .metric strong { display: block; color: #ff3b68; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 14px; }
    th { background: #f3f4f6; }
    a { color: #db2550; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div>生成时间：${escapeHtml(analytics.generatedAt)}</div>
  </header>
  <main>
    <section class="metrics">
      <div class="metric"><strong>${metric.notes}</strong>笔记</div>
      <div class="metric"><strong>${metric.videos}</strong>视频</div>
      <div class="metric"><strong>${metric.avgLikes}</strong>平均点赞</div>
      <div class="metric"><strong>${metric.totalComments}</strong>总评论</div>
    </section>
    <h2>关键词机会</h2>
    <table><thead><tr><th>关键词</th><th>层级</th><th>Top1点赞</th><th>Top10均值</th><th>收藏/点赞</th><th>机会分</th></tr></thead><tbody>${keywordRows}</tbody></table>
    <h2>热门笔记</h2>
    <table><thead><tr><th>#</th><th>标题</th><th>作者</th><th>类型</th><th>点赞</th><th>收藏</th><th>评论</th><th>热度</th></tr></thead><tbody>${noteRows}</tbody></table>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
