import { describe, expect, it } from "vitest";
import type { AiWorkflowKey, AnalyticsReport, CommentRecord, NoteRecord, SearchJob } from "../src/shared/types.js";
import {
  buildAiWorkflowPrompt,
  buildCustomWorkflowPrompt,
  buildDefaultGuidedConfig,
  buildGuidedWorkflowPrompt,
  getDefaultPromptTemplate,
  listAiPromptInfos,
  renderPromptTemplate,
  validateCustomPromptTemplate,
  validatePromptTemplate
} from "../src/server/services/aiPrompts.js";

const job: SearchJob = {
  id: "job1",
  keywords: ["武汉相亲"],
  sort: "popular",
  noteType: "all",
  pages: 1,
  commentPages: 1,
  concurrency: 2,
  status: "completed",
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-18T00:00:00.000Z",
  progress: { seeded: 1, pending: 0, running: 0, done: 1, error: 0, total: 1 }
};

const note: NoteRecord = {
  id: "n1",
  jobIds: ["job1"],
  keywords: ["武汉相亲"],
  title: "武汉相亲避坑清单",
  desc: "相亲前先看信息透明度，再看沟通节奏。",
  type: "normal",
  webUrl: "https://www.xiaohongshu.com/explore/n1?xsec_token=t",
  noteUrl: "https://www.xiaohongshu.com/explore/n1",
  authorId: "u1",
  authorName: "alice",
  likedCount: 1000,
  collectedCount: 500,
  commentCount: 120,
  shareCount: 30,
  hotScore: 1650,
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-18T00:00:00.000Z"
};

const analytics: AnalyticsReport = {
  jobId: "job1",
  generatedAt: "2026-06-18T00:00:00.000Z",
  overview: { notes: 1, videos: 0, imageNotes: 1, avgLikes: 1000, totalComments: 120, totalCollects: 500, totalShares: 30 },
  keywords: [
    {
      keyword: "武汉相亲",
      top1Likes: 1000,
      top10AvgLikes: 600,
      top1Collects: 500,
      collectLikeRatio: 0.5,
      commentLikeRatio: 0.12,
      competitionDensity: 0.3,
      opportunityScore: 88,
      tier: "A",
      noteCount: 1
    }
  ],
  authors: [{ authorId: "u1", nickname: "alice", fansCount: 10000, noteCount: 12, avgLikes: 500, medianLikes: 300, maxLikes: 1000, breakoutRatio: 2 }],
  formBreakdown: [{ form: "normal", noteCount: 1, top1Likes: 1000, top10AvgLikes: 600, collectLikeRatio: 0.5 }],
  templates: [{ noteId: "n1", title: "武汉相亲避坑清单", score: 90, hookPatterns: ["清单钩子"], contentType: "reference" }]
};

const comments: CommentRecord[] = [
  { id: "c1", noteId: "n1", authorName: "user1", content: "怎么判断对方靠谱不靠谱？", likedCount: 30, createdAt: "2026-06-18T00:00:00.000Z" }
];

const context = {
  job,
  analytics,
  notes: [note],
  selectedNote: note,
  selectedNotes: [note],
  comments,
  authors: [{ id: "u1", nickname: "alice", fansCount: 10000, followingCount: 10, likedCount: 20000, noteCount: 12, updatedAt: "2026-06-18T00:00:00.000Z" }],
  authorPosts: [{ id: "p1", authorId: "u1", title: "线下相亲复盘", type: "normal" as const, likedCount: 500, collectedCount: 200, commentCount: 40 }]
};

describe("AI prompt library", () => {
  it("describes every workflow prompt for the frontend", () => {
    const infos = listAiPromptInfos();

    expect(infos).toHaveLength(9);
    expect(infos.every((info) => info.description && info.version && info.inputRequirements.length && info.outputSections.length)).toBe(true);
    expect(infos.map((info) => info.key)).toContain("content-planning");
    expect(infos.find((info) => info.key === "draft-review")?.title).toBe("种草笔记审稿");
  });

  it("builds specialized workflow prompts with distinct sections", () => {
    const expectations: Array<[AiWorkflowKey, string]> = [
      ["content-planning", "# 内容策划方案"],
      ["audience-insight", "# 受众洞察报告"],
      ["competitor-analysis", "# 竞品分析报告"],
      ["viral-deep-dive", "# 单篇爆款拆解"],
      ["viral-batch-deep-dive", "# 多篇爆款对比拆解"],
      ["viral-template", "# 爆款模板库"],
      ["note-analysis", "# 单篇笔记优化分析"],
      ["draft-review", "# AI 审稿报告"],
      ["note-writing", "# 小红书笔记草稿"]
    ];

    for (const [key, heading] of expectations) {
      const result = buildAiWorkflowPrompt(key, context);
      expect(result.promptKey).toBe(key);
      expect(result.promptVersion).toBe("运营模板 2026.07");
      expect(result.promptSource).toBe("default");
      expect(result.contextSummary).toContain("武汉相亲");
      expect(result.prompt).toContain(heading);
      expect(result.prompt).toContain("不允许建议自动评论、自动发布、自动点赞、自动收藏");
    }
  });

  it("renders custom workflow templates with structured context variables", () => {
    const template = "任务：{job}\n选中：{selectedNote}\n要求：{focus}";
    const result = buildCustomWorkflowPrompt("note-analysis", template, context, "只看标题");

    expect(result.promptSource).toBe("custom");
    expect(result.promptTitle).toBe("单篇笔记优化");
    expect(result.prompt).toContain("武汉相亲");
    expect(result.prompt).toContain("武汉相亲避坑清单");
    expect(result.prompt).toContain("只看标题");
    expect(getDefaultPromptTemplate("note-analysis")).toContain("{selectedNote}");
  });

  it("builds guided prompts from editable business configuration", () => {
    const config = {
      ...buildDefaultGuidedConfig("content-planning"),
      role: "小红书选题顾问",
      objective: "输出一份适合运营直接执行的选题计划。",
      outputSections: ["机会判断", "标题方向"]
    };
    const result = buildGuidedWorkflowPrompt("content-planning", config, context, "优先看高收藏");

    expect(result.promptSource).toBe("guided");
    expect(result.prompt).toContain("小红书选题顾问");
    expect(result.prompt).toContain("机会判断");
    expect(result.prompt).toContain("武汉相亲");
    expect(result.prompt).toContain("优先看高收藏");
  });

  it("validates advanced prompt variables before activation", () => {
    const messages = validatePromptTemplate("content-planning", "任务：{job}\n热门：{topNote}\n要求：{focus}");

    expect(messages.some((message) => message.level === "error" && message.variable === "topNote")).toBe(true);
    expect(messages.some((message) => message.suggestion === "topNotes")).toBe(true);
  });

  it("validates and renders reusable custom prompt templates", () => {
    const validation = validateCustomPromptTemplate("任务：{job}\n未知：{topNote}\n要求：{focus}");
    const rendered = renderPromptTemplate("任务：{job}\n热门：{topNotes}\n要求：{focus}", context, "优先输出标题方向");

    expect(validation.some((message) => message.level === "error" && message.variable === "topNote")).toBe(true);
    expect(validation.some((message) => message.suggestion === "topNotes")).toBe(true);
    expect(rendered).toContain("武汉相亲");
    expect(rendered).toContain("武汉相亲避坑清单");
    expect(rendered).toContain("优先输出标题方向");
  });
});
