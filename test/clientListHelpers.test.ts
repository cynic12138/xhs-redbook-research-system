import { describe, expect, it } from "vitest";
import type { AiArtifact, ContentPlaybook, ContentProject, ContentReviewRun } from "../src/shared/types.js";
import { WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY } from "../src/shared/contentReviewPolicy.js";
import {
  applyContentPlaybookTemplate,
  canSelectPromptKey,
  compactContentText,
  contentPlaybookInputFromForm,
  contentPlaybookTemplates,
  contentReviewRuleSummary,
  contentReviewToForm,
  contentResultCounts,
  aiResourceJobId,
  goalPrimaryArtifactId,
  getContentArtifacts,
  loadArtifactForOpen,
  noteToBatchReviewItem,
  normalizeAiResourceScope,
  orchestrationLatestArtifactId,
  playbookToForm,
  createDefaultContentPlaybookForm,
  prependUniqueById,
  resolveSelectedAiArtifact,
  resolveProjectRefreshState,
  severityLabel,
  DEFAULT_CONTENT_REVIEW_RULE_LABEL,
  upsertById
} from "../src/client/App.js";

describe("client list merge helpers", () => {
  const artifact = (id: string, jobId?: string): AiArtifact => ({
    id,
    jobId,
    workflowKey: "draft-review",
    title: id,
    markdown: `# ${id}`,
    source: "local",
    status: "completed",
    createdAt: "2026-07-20T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z"
  });

  it("defaults AI resources to all jobs and only filters an explicit current-job scope", () => {
    expect(normalizeAiResourceScope("all", "job_1")).toBe("all");
    expect(aiResourceJobId("all", "job_1")).toBeUndefined();
    expect(normalizeAiResourceScope("current", "job_1")).toBe("current");
    expect(aiResourceJobId("current", "job_1")).toBe("job_1");
  });

  it("falls back to all resources when the current job is no longer valid", () => {
    expect(normalizeAiResourceScope("current", "")).toBe("all");
    expect(aiResourceJobId("current", "")).toBeUndefined();
  });

  it("keeps an opened artifact snapshot when the scoped list no longer contains it", () => {
    const opened = artifact("review_job_a", "job_a");

    expect(resolveSelectedAiArtifact([artifact("goal_job_b", "job_b")], opened.id, opened)).toBe(opened);
    expect(resolveSelectedAiArtifact([artifact("review_job_a", "job_a")], opened.id, opened)?.id).toBe(opened.id);
  });

  it("loads a linked artifact by id when the current scoped list does not contain it", async () => {
    const fetched = artifact("review_job_a", "job_a");
    let requestedId = "";

    const result = await loadArtifactForOpen([], fetched.id, async (artifactId) => {
      requestedId = artifactId;
      return fetched;
    });

    expect(requestedId).toBe(fetched.id);
    expect(result).toBe(fetched);
  });

  it("resolves explicit Goal and orchestration result links without changing navigation state", () => {
    expect(goalPrimaryArtifactId({ artifactIds: ["dossier", "draft", "review"] })).toBe("dossier");
    expect(goalPrimaryArtifactId({ artifactIds: [] })).toBe("");
    expect(orchestrationLatestArtifactId({ artifactIds: ["first", "latest"] })).toBe("latest");
    expect(orchestrationLatestArtifactId({ artifactIds: [] })).toBe("");
  });

  it("upserts one item to the front and removes its older copy", () => {
    const result = upsertById([{ id: "old", value: 1 }, { id: "keep", value: 2 }], { id: "old", value: 3 });

    expect(result).toEqual([{ id: "old", value: 3 }, { id: "keep", value: 2 }]);
  });

  it("prepends a batch while preserving incoming order and removing old copies", () => {
    const result = prependUniqueById(
      [{ id: "a", value: 1 }, { id: "b", value: 2 }, { id: "c", value: 3 }],
      [{ id: "c", value: 30 }, { id: "a", value: 10 }]
    );

    expect(result).toEqual([{ id: "c", value: 30 }, { id: "a", value: 10 }, { id: "b", value: 2 }]);
  });

  it("keeps only the first item when an incoming batch repeats ids", () => {
    const result = prependUniqueById([{ id: "existing", value: 1 }], [
      { id: "next", value: 2 },
      { id: "next", value: 3 }
    ]);

    expect(result).toEqual([{ id: "next", value: 2 }, { id: "existing", value: 1 }]);
  });

  it("maps a note into a selected batch review item", () => {
    expect(noteToBatchReviewItem({
      id: "note1",
      title: "孕妈出门携带",
      desc: "这是一篇需要审稿的小红书笔记正文。",
      keywords: ["孕期好物", "日常分享"]
    })).toEqual({
      id: "note_note1",
      title: "孕妈出门携带",
      body: "这是一篇需要审稿的小红书笔记正文。",
      tags: "孕期好物, 日常分享",
      selected: true
    });
  });

  it("compacts review text previews", () => {
    expect(compactContentText(" 第一段\n\n第二段  ", 20)).toBe("第一段 第二段");
    expect(compactContentText("", 20)).toBe("暂无内容");
    expect(compactContentText("1234567890", 6)).toBe("12345…");
  });

  it("labels review issue severity", () => {
    expect(severityLabel("blocker")).toBe("必须修改");
    expect(severityLabel("warning")).toBe("建议修改");
    expect(severityLabel("info")).toBe("提示");
  });

  it("summarizes content result archive inputs", () => {
    const artifacts = [
      { id: "other", workflowKey: "audience-insight", createdAt: "2026-07-01T03:00:00.000Z" },
      { id: "draft", workflowKey: "note-writing", createdAt: "2026-07-01T01:00:00.000Z" },
      { id: "review", workflowKey: "draft-review", createdAt: "2026-07-01T02:00:00.000Z" }
    ] as const;

    expect(getContentArtifacts([...artifacts]).map((artifact) => artifact.id)).toEqual(["review", "draft"]);
    expect(contentResultCounts(
      [{ status: "draft" }, { status: "reviewed" }],
      [{ risk: "high" }, { risk: "pass" }],
      [...artifacts]
    )).toEqual({
      drafts: 2,
      reviewedDrafts: 1,
      reviews: 2,
      highRiskReviews: 1,
      passedReviews: 1,
      contentArtifacts: 2
    });
  });

  it("applies a content playbook template while preserving the product name", () => {
    const result = applyContentPlaybookTemplate({
      name: "旧规则",
      productName: "蜂蜜露",
      category: "旧行业",
      forbiddenTerms: "",
      sensitiveClaims: "",
      allowedSellingPoints: "",
      requiredSections: "",
      toneWords: "",
      personas: "",
      scenarios: "",
      tags: "",
      replacements: ""
    }, "maternal");

    expect(result.productName).toBe("蜂蜜露");
    expect(result.name).toBe("母婴孕妈审稿规则");
    expect(result.category).toBe("母婴小红书种草");
    expect(result.sensitiveClaims).toContain("宫缩风险");
    expect(result.personas).toContain("孕妈");
  });

  it("puts the specialty template first and applies every shared specialty field", () => {
    expect(contentPlaybookTemplates[0]?.key).toBe("specialty");
    expect(contentPlaybookTemplates[0]?.form.productName).toBe(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.productName);

    const result = applyContentPlaybookTemplate({
      name: "旧规则",
      productName: "",
      category: "旧行业",
      forbiddenTerms: "",
      sensitiveClaims: "",
      allowedSellingPoints: "",
      requiredSections: "",
      toneWords: "",
      personas: "",
      scenarios: "",
      tags: "",
      replacements: ""
    }, "specialty");

    expect(result.name).toBe(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.name);
    expect(result.productName).toBe(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.productName);
    expect(result.requiredSections).toContain("标题");
    expect(result.toneWords).toContain("真实分享");
    expect(JSON.parse(result.replacements)).toEqual(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.replacements);
  });

  it("creates a complete specialty default playbook without accepting a product alias", () => {
    const form = createDefaultContentPlaybookForm();

    expect(form.name).toBe(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.name);
    expect(form.productName).toBe(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.productName);
    expect(form.forbiddenTerms).toContain(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.forbiddenTerms[0]);
    expect(form.requiredSections).toContain(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.requiredSections[0]);
    expect(JSON.parse(form.replacements)).toEqual(WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.replacements);
  });

  it("round trips every playbook field including structured replacements", () => {
    const playbook: ContentPlaybook = {
      id: "playbook_1",
      name: "完整规则",
      productName: "周十五蜂蜜露",
      category: "小红书种草",
      forbiddenTerms: ["禁用词"],
      sensitiveClaims: ["敏感词"],
      allowedSellingPoints: ["真实体验"],
      requiredSections: ["标题", "正文"],
      toneWords: ["自然", "克制"],
      personas: ["用户"],
      scenarios: ["通勤"],
      tags: ["标签"],
      replacements: [{ from: "原词 => 仍是原词", to: "替换词 => 仍是替换词", reason: "原因 => 仍是原因" }],
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    };

    expect(contentPlaybookInputFromForm(playbookToForm(playbook))).toEqual({
      name: playbook.name,
      productName: playbook.productName,
      category: playbook.category,
      forbiddenTerms: playbook.forbiddenTerms,
      sensitiveClaims: playbook.sensitiveClaims,
      allowedSellingPoints: playbook.allowedSellingPoints,
      requiredSections: playbook.requiredSections,
      toneWords: playbook.toneWords,
      personas: playbook.personas,
      scenarios: playbook.scenarios,
      tags: playbook.tags,
      replacements: playbook.replacements
    });
  });

  it("rejects invalid structured replacement input instead of dropping it during save conversion", () => {
    const form = createDefaultContentPlaybookForm();

    expect(() => contentPlaybookInputFromForm({ ...form, replacements: "{" })).toThrow("替换规则必须是合法 JSON 数组");
    expect(() => contentPlaybookInputFromForm({ ...form, replacements: "{}" })).toThrow("替换规则必须是 JSON 数组");
    expect(() => contentPlaybookInputFromForm({ ...form, replacements: '[{"from":"原词","to":"替换词"},{"from":1,"to":"错误"}]' })).toThrow("替换规则第 2 条必须包含字符串 from 和 to");
  });

  it("keeps an intentionally empty replacement rule list", () => {
    expect(contentPlaybookInputFromForm({ ...createDefaultContentPlaybookForm(), replacements: "" }).replacements).toEqual([]);
  });

  it("allows prompt-center navigation only when the target prompt selection succeeds", () => {
    expect(canSelectPromptKey("draft-review", "draft-review", false)).toBe(true);
    expect(canSelectPromptKey("content-planning", "draft-review", true)).toBe(true);
    expect(canSelectPromptKey("content-planning", "draft-review", false)).toBe(false);
  });

  it("keeps every industry template's existing core terms and supplies structured field defaults", () => {
    const templates = [
      ["general", "forbiddenTerms", "yyds"],
      ["maternal", "forbiddenTerms", "宝妈必备"],
      ["food", "forbiddenTerms", "减脂神器"],
      ["education", "sensitiveClaims", "保过"]
    ] as const;

    for (const [key, coreField, coreTerm] of templates) {
      const result = applyContentPlaybookTemplate({
        name: "",
        productName: "产品",
        category: "",
        forbiddenTerms: "",
        sensitiveClaims: "",
        allowedSellingPoints: "",
        requiredSections: "",
        toneWords: "",
        personas: "",
        scenarios: "",
        tags: "",
        replacements: ""
      }, key);

      expect(result[coreField]).toContain(coreTerm);
      expect(result.requiredSections).toContain("标题");
      expect(result.toneWords).toContain("真实分享");
      expect(JSON.parse(result.replacements)).not.toEqual([]);
    }
  });

  it("keeps revised content and tag order when preparing a rereview form", () => {
    const review = {
      revisedTitle: "修改标题",
      revisedBody: "修改正文",
      revisedTags: ["先", "后", "末"],
      originalBody: "原正文"
    } as ContentReviewRun;

    expect(contentReviewToForm(review)).toEqual({ title: "修改标题", body: "修改正文", tags: "先, 后, 末" });
  });

  it("uses the built-in specialty policy summary when no saved playbook is selected", () => {
    expect(contentReviewRuleSummary()).toEqual({
      label: DEFAULT_CONTENT_REVIEW_RULE_LABEL,
      forbiddenTermCount: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.forbiddenTerms.length,
      sensitiveClaimCount: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.sensitiveClaims.length
    });
  });

  it("shows unique merged specialty counts for a saved specialty playbook", () => {
    expect(contentReviewRuleSummary({
      name: "已保存专项规则",
      productName: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.productName,
      forbiddenTerms: [WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.forbiddenTerms[0], "自定义禁用词"],
      sensitiveClaims: [WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.sensitiveClaims[0], "自定义敏感词"]
    })).toEqual({
      label: "已保存专项规则",
      forbiddenTermCount: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.forbiddenTerms.length + 1,
      sensitiveClaimCount: WEEK_FIFTEEN_HONEY_DEW_REVIEW_POLICY.sensitiveClaims.length + 1
    });
  });

  it("shows only saved counts for a non-specialty product playbook", () => {
    expect(contentReviewRuleSummary({
      name: "其他产品规则",
      productName: "其他产品",
      forbiddenTerms: ["a", "b"],
      sensitiveClaims: ["c"]
    })).toEqual({ label: "其他产品规则", forbiddenTermCount: 2, sensitiveClaimCount: 1 });
  });

  it("keeps the unbound review rule option label fixed", () => {
    expect(DEFAULT_CONTENT_REVIEW_RULE_LABEL).toBe("周十五蜂蜜露专项审稿规则（内置默认）");
  });

  it("keeps dirty content project edits during refresh", () => {
    const projects: ContentProject[] = [{
      id: "content_project_1",
      name: "蜂蜜露项目",
      productName: "蜂蜜露",
      targetAudience: ["孕妈"],
      scenarios: ["出门携带"],
      goals: ["批量生产"],
      status: "planning",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    }];

    expect(resolveProjectRefreshState([...projects], "", false)).toMatchObject({ selectedId: "content_project_1", applyForm: true });
    expect(resolveProjectRefreshState([...projects], "draft_local", true)).toEqual({ selectedId: "draft_local", applyForm: false });
  });
});
