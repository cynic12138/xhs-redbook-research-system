import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStore } from "../src/server/storage/localStore.js";
import {
  generateContentDraft,
  deleteContentPlaybook,
  listContentPlaybooks,
  reviewContentDraft,
  reviewContentDraftBatch,
  saveContentPlaybook,
  scanContentDraft
} from "../src/server/services/contentStudioService.js";

describe("content studio service", () => {
  it("stores playbooks as real local records and scans risky draft terms", async () => {
    const store = new LocalStore(await createTempDataDir());
    expect(await listContentPlaybooks(store)).toEqual([]);
    const playbook = await saveContentPlaybook({
      name: "孕妈种草规则",
      productName: "蜂蜜露",
      category: "小红书种草",
      forbiddenTerms: ["封神", "救命神器"],
      sensitiveClaims: ["通便特效", "百分百有效"],
      allowedSellingPoints: ["真实使用感"],
      personas: ["孕妈"],
      scenarios: ["日常分享"],
      tags: ["孕期好物"]
    }, undefined, store);

    expect((await listContentPlaybooks(store)).map((item) => item.id)).toEqual([playbook.id]);
    const scan = scanContentDraft({
      title: "这个产品封神了",
      body: "救命神器，通便特效，百分百有效，闭眼冲。",
      tags: ["好物"]
    }, playbook);

    expect(scan.risk).toBe("high");
    expect(scan.issues.some((issue) => issue.category === "敏感功效")).toBe(true);
    expect(scan.revisedBody).not.toContain("通便特效");
  });

  it("can save multiple playbooks and delete the last one without recreating a default card", async () => {
    const store = new LocalStore(await createTempDataDir());
    const first = await saveContentPlaybook({ name: "规则 A", productName: "产品 A", forbiddenTerms: [], sensitiveClaims: [] }, undefined, store);
    const second = await saveContentPlaybook({ name: "规则 B", productName: "产品 B", forbiddenTerms: [], sensitiveClaims: [] }, undefined, store);

    expect(await listContentPlaybooks(store)).toHaveLength(2);
    await deleteContentPlaybook(first.id, store);
    expect((await listContentPlaybooks(store)).map((item) => item.id)).toEqual([second.id]);
    await deleteContentPlaybook(second.id, store);
    expect(await listContentPlaybooks(store)).toEqual([]);
  });

  it("preserves intentionally cleared playbook lists", async () => {
    const store = new LocalStore(await createTempDataDir());
    const playbook = await saveContentPlaybook({
      name: "可清空规则",
      productName: "产品",
      forbiddenTerms: ["封神"],
      sensitiveClaims: ["治疗"],
      allowedSellingPoints: ["真实体验"],
      personas: ["孕妈"],
      scenarios: ["日常分享"],
      tags: ["好物"]
    }, undefined, store);

    const updated = await saveContentPlaybook({
      name: "可清空规则",
      productName: "产品",
      forbiddenTerms: [],
      sensitiveClaims: [],
      allowedSellingPoints: [],
      personas: [],
      scenarios: [],
      tags: []
    }, playbook.id, store);

    expect(updated.forbiddenTerms).toEqual([]);
    expect(updated.sensitiveClaims).toEqual([]);
    expect(updated.allowedSellingPoints).toEqual([]);
    expect(updated.personas).toEqual([]);
    expect(updated.scenarios).toEqual([]);
    expect(updated.tags).toEqual([]);
  });

  it("creates a review artifact without an AI model", async () => {
    const store = new LocalStore(await createTempDataDir());

    const result = await reviewContentDraft({
      title: "孕妈好物 yyds",
      body: "这个产品是救命神器，效果拉满，闭眼冲。",
      tags: ["孕妈好物"]
    }, store);

    expect(result.review.issues.length).toBeGreaterThan(0);
    expect(result.artifact.workflowKey).toBe("draft-review");
    expect(result.artifact.markdown).toContain("AI 审稿报告");
    expect(await store.read("aiArtifacts")).toHaveLength(1);
  });

  it("reviews multiple selected drafts in one batch", async () => {
    const store = new LocalStore(await createTempDataDir());

    const result = await reviewContentDraftBatch({
      items: [
        { id: "row_1", title: "孕妈好物", body: "这个产品是救命神器，效果拉满。", tags: ["孕妈"] },
        { id: "row_2", title: "出门携带", body: "掌心大小，放包里很方便。", tags: ["日常"] }
      ]
    }, store);

    expect(result.reviews).toHaveLength(2);
    expect(result.artifacts).toHaveLength(2);
    expect(result.reviews[0]?.artifactId).toBe(result.artifacts[0]?.id);
    expect(await store.read("contentReviews")).toHaveLength(2);
    expect(await store.read("aiArtifacts")).toHaveLength(2);
  });

  it("generates a draft and automatically links a review", async () => {
    const store = new LocalStore(await createTempDataDir());

    const result = await generateContentDraft({
      brief: {
        productName: "蜂蜜露",
        persona: "孕妈",
        painPoint: "孕期便秘",
        scenario: "出门携带",
        channel: "朋友推荐",
        sellingPoints: ["细头设计", "掌心大小", "温和表达"],
        tone: "口语化",
        length: "medium",
        keywords: ["孕期好物"]
      }
    }, store);

    expect(result.draft.title).toContain("蜂蜜露");
    expect(result.draft.reviewId).toBe(result.review.id);
    expect(result.reviewArtifact.workflowKey).toBe("draft-review");
    expect(await store.read("contentDrafts")).toHaveLength(1);
    expect(await store.read("contentReviews")).toHaveLength(1);
  });
});

function createTempDataDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "xhs-content-studio-"));
}
