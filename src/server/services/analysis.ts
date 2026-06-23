import type {
  AnalyticsReport,
  AuthorMetric,
  AuthorPostRecord,
  AuthorRecord,
  CommentRecord,
  KeywordMetric,
  NoteRecord,
  ViralAnalysis
} from "../../shared/types.js";
import { mean, median, nowIso, ratio } from "../../shared/utils.js";

const emotionWords = ["震惊", "后悔", "救命", "绝了", "崩溃", "惊喜", "真实", "避雷", "必看"];
const identityWords = ["新手", "学生", "打工人", "宝妈", "情侣", "姐妹", "男生", "女生", "老板"];

export function analyzeNote(
  note: NoteRecord,
  comments: CommentRecord[],
  authorPosts: AuthorPostRecord[] = []
): ViralAnalysis {
  const body = note.desc ?? "";
  const commentThemes = extractThemes(comments);
  const questionCount = comments.filter((comment) => /[?？吗呢]$/.test(comment.content.trim())).length;
  const authorLikes = authorPosts.map((post) => post.likedCount).filter((value) => value > 0);
  const authorMedianLikes = median(authorLikes);
  const viralMultiplier = authorMedianLikes ? Number((note.likedCount / authorMedianLikes).toFixed(2)) : 0;
  const collectLikeRatio = ratio(note.collectedCount, note.likedCount);
  const commentLikeRatio = ratio(note.commentCount || comments.length, note.likedCount);
  const shareLikeRatio = ratio(note.shareCount, note.likedCount);
  const hookPatterns = detectHooks(note.title);
  const contentType = collectLikeRatio > 0.4 ? "reference" : collectLikeRatio >= 0.2 ? "insight" : "entertainment";
  const discussionType = commentLikeRatio > 0.15 ? "discussion" : commentLikeRatio >= 0.05 ? "normal" : "passive";
  const score = Math.min(
    100,
    Math.round(
      hookPatterns.length * 8 +
        Math.min(25, collectLikeRatio * 50) +
        Math.min(20, commentLikeRatio * 80) +
        Math.min(20, viralMultiplier * 5) +
        Math.min(15, comments.length / 2) +
        (body.length > 80 ? 8 : 0)
    )
  );

  return {
    score,
    hookPatterns,
    contentType,
    discussionType,
    collectLikeRatio,
    commentLikeRatio,
    shareLikeRatio,
    questionRate: comments.length ? Number((questionCount / comments.length).toFixed(4)) : 0,
    commentThemes,
    titleLength: note.title.length,
    bodyLength: body.length,
    paragraphCount: body ? body.split(/\n+/).filter(Boolean).length : 0,
    authorMedianLikes,
    viralMultiplier,
    generatedAt: nowIso()
  };
}

export function buildAnalytics(
  jobId: string,
  notes: NoteRecord[],
  authors: AuthorRecord[],
  authorPosts: AuthorPostRecord[]
): AnalyticsReport {
  const related = notes.filter((note) => note.jobIds.includes(jobId));
  const videos = related.filter((note) => note.type === "video").length;
  const imageNotes = related.filter((note) => note.type === "normal").length;

  return {
    jobId,
    generatedAt: nowIso(),
    overview: {
      notes: related.length,
      videos,
      imageNotes,
      avgLikes: mean(related.map((note) => note.likedCount)),
      totalComments: related.reduce((sum, note) => sum + note.commentCount, 0),
      totalCollects: related.reduce((sum, note) => sum + note.collectedCount, 0),
      totalShares: related.reduce((sum, note) => sum + note.shareCount, 0)
    },
    keywords: buildKeywordMetrics(related),
    authors: buildAuthorMetrics(related, authors, authorPosts),
    formBreakdown: buildFormBreakdown(related),
    templates: related
      .filter((note) => note.analysis)
      .sort((a, b) => (b.analysis?.score ?? 0) - (a.analysis?.score ?? 0))
      .slice(0, 8)
      .map((note) => ({
        noteId: note.id,
        title: note.title,
        score: note.analysis?.score ?? 0,
        hookPatterns: note.analysis?.hookPatterns ?? [],
        contentType: note.analysis?.contentType ?? "unknown"
      }))
  };
}

export function buildKeywordMetrics(notes: NoteRecord[]): KeywordMetric[] {
  const keywords = [...new Set(notes.flatMap((note) => note.keywords))];
  return keywords
    .map((keyword) => {
      const related = notes.filter((note) => note.keywords.includes(keyword)).sort((a, b) => b.likedCount - a.likedCount);
      const top10 = related.slice(0, 10);
      const top1 = top10[0];
      const competitionDensity = top10.length ? top10.filter((note) => note.likedCount > 1000).length / top10.length : 0;
      const top1Likes = top1?.likedCount ?? 0;
      const score = Math.round(top1Likes * (1 / Math.max(competitionDensity, 0.1)));
      return {
        keyword,
        top1Likes,
        top10AvgLikes: mean(top10.map((note) => note.likedCount)),
        top1Collects: top1?.collectedCount ?? 0,
        collectLikeRatio: ratio(top10.reduce((sum, note) => sum + note.collectedCount, 0), top10.reduce((sum, note) => sum + note.likedCount, 0)),
        commentLikeRatio: ratio(top10.reduce((sum, note) => sum + note.commentCount, 0), top10.reduce((sum, note) => sum + note.likedCount, 0)),
        competitionDensity: Number(competitionDensity.toFixed(2)),
        opportunityScore: score,
        tier: tierFor(top1Likes),
        noteCount: related.length
      } satisfies KeywordMetric;
    })
    .sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function buildAuthorMetrics(notes: NoteRecord[], authors: AuthorRecord[], authorPosts: AuthorPostRecord[]): AuthorMetric[] {
  const ids = [...new Set(notes.map((note) => note.authorId).filter(Boolean))] as string[];
  return ids
    .map((authorId) => {
      const author = authors.find((item) => item.id === authorId);
      const posts = authorPosts.filter((post) => post.authorId === authorId);
      const likes = posts.length ? posts.map((post) => post.likedCount) : notes.filter((note) => note.authorId === authorId).map((note) => note.likedCount);
      const med = median(likes);
      const maxLikes = Math.max(0, ...likes);
      return {
        authorId,
        nickname: author?.nickname ?? notes.find((note) => note.authorId === authorId)?.authorName ?? authorId,
        fansCount: author?.fansCount ?? 0,
        noteCount: posts.length || notes.filter((note) => note.authorId === authorId).length,
        avgLikes: mean(likes),
        medianLikes: med,
        maxLikes,
        breakoutRatio: med ? Number((maxLikes / med).toFixed(2)) : 0
      };
    })
    .sort((a, b) => b.maxLikes - a.maxLikes)
    .slice(0, 30);
}

function buildFormBreakdown(notes: NoteRecord[]): AnalyticsReport["formBreakdown"] {
  return (["normal", "video", "unknown"] as const).map((form) => {
    const related = notes.filter((note) => note.type === form).sort((a, b) => b.likedCount - a.likedCount);
    const top10 = related.slice(0, 10);
    return {
      form,
      noteCount: related.length,
      top1Likes: top10[0]?.likedCount ?? 0,
      top10AvgLikes: mean(top10.map((note) => note.likedCount)),
      collectLikeRatio: ratio(top10.reduce((sum, note) => sum + note.collectedCount, 0), top10.reduce((sum, note) => sum + note.likedCount, 0))
    };
  });
}

function detectHooks(title: string): string[] {
  const hooks: string[] = [];
  if (/\d/.test(title)) hooks.push("数字钩子");
  if (/[?？]/.test(title)) hooks.push("提问钩子");
  if (/[!！]/.test(title)) hooks.push("强情绪");
  if (/第[一二三四五六七八九十\d]+|步骤|方法|清单|攻略/.test(title)) hooks.push("清单结构");
  if (identityWords.some((word) => title.includes(word))) hooks.push("身份钩子");
  if (emotionWords.some((word) => title.includes(word))) hooks.push("情绪词");
  if (/不是|而是|竟然|原来|对比|差别/.test(title)) hooks.push("反差钩子");
  return hooks;
}

function extractThemes(comments: CommentRecord[]): Array<{ keyword: string; count: number }> {
  const counts = new Map<string, number>();
  const stop = new Set(["这个", "真的", "感觉", "可以", "就是", "哈哈", "姐妹", "怎么", "为什么", "还是"]);
  for (const comment of comments) {
    const words = comment.content.match(/[\u4e00-\u9fa5]{2,6}|[A-Za-z][A-Za-z0-9#+.-]{1,20}/g) ?? [];
    for (const word of words) {
      if (stop.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([keyword, count]) => ({ keyword, count }));
}

function tierFor(top1Likes: number): "S" | "A" | "B" | "C" {
  if (top1Likes > 100_000) return "S";
  if (top1Likes >= 20_000) return "A";
  if (top1Likes >= 5_000) return "B";
  return "C";
}
