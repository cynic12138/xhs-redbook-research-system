import { describe, expect, it } from "vitest";
import {
  applyContentPlaybookTemplate,
  compactContentText,
  contentResultCounts,
  getContentArtifacts,
  noteToBatchReviewItem,
  prependUniqueById,
  severityLabel,
  upsertById
} from "../src/client/App.js";

describe("client list merge helpers", () => {
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
      personas: "",
      scenarios: "",
      tags: ""
    }, "maternal");

    expect(result.productName).toBe("蜂蜜露");
    expect(result.name).toBe("母婴孕妈审稿规则");
    expect(result.category).toBe("母婴小红书种草");
    expect(result.sensitiveClaims).toContain("宫缩风险");
    expect(result.personas).toContain("孕妈");
  });
});
