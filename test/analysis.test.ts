import { describe, expect, it } from "vitest";
import type { AuthorPostRecord, CommentRecord, NoteRecord } from "../src/shared/types.js";
import { analyzeNote, buildKeywordMetrics } from "../src/server/services/analysis.js";

const baseNote: NoteRecord = {
  id: "n1",
  jobIds: ["job1"],
  keywords: ["武汉相亲"],
  title: "3个武汉相亲避雷方法？",
  desc: "第一步看评论，第二步看收藏。",
  type: "normal",
  webUrl: "https://example.com",
  noteUrl: "https://example.com",
  authorId: "u1",
  authorName: "alice",
  likedCount: 1000,
  collectedCount: 500,
  commentCount: 180,
  shareCount: 40,
  hotScore: 2120,
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-18T00:00:00.000Z"
};

describe("analysis", () => {
  it("classifies high collect and discussion notes", () => {
    const comments: CommentRecord[] = [
      { id: "c1", noteId: "n1", content: "怎么判断靠谱？", likedCount: 10, createdAt: baseNote.createdAt },
      { id: "c2", noteId: "n1", content: "武汉线下活动在哪", likedCount: 5, createdAt: baseNote.createdAt }
    ];
    const posts: AuthorPostRecord[] = [
      { id: "p1", authorId: "u1", title: "old", type: "normal", likedCount: 200, collectedCount: 20, commentCount: 5 }
    ];

    const result = analyzeNote(baseNote, comments, posts);

    expect(result.contentType).toBe("reference");
    expect(result.discussionType).toBe("discussion");
    expect(result.hookPatterns).toContain("数字钩子");
    expect(result.viralMultiplier).toBe(5);
  });

  it("builds keyword opportunity metrics", () => {
    const metrics = buildKeywordMetrics([
      baseNote,
      { ...baseNote, id: "n2", likedCount: 300, collectedCount: 30, commentCount: 5, keywords: ["武汉相亲"] }
    ]);

    expect(metrics[0]?.keyword).toBe("武汉相亲");
    expect(metrics[0]?.top1Likes).toBe(1000);
    expect(metrics[0]?.noteCount).toBe(2);
  });
});
