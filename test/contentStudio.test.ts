import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStore } from "../src/server/storage/localStore.js";
import {
  acceptContentDraftReview,
  addContentProjectMaterialsFromNotes,
  generateContentDraft,
  generateContentDraftBatch,
  deleteContentProject,
  deleteContentProjectMaterial,
  deleteContentPlaybook,
  listContentProjectMaterials,
  listContentPlaybookRevisions,
  listContentPlaybooks,
  listContentProjects,
  reviewContentDraft,
  reviewContentDraftBatch,
  restoreContentPlaybookRevision,
  saveContentProject,
  saveContentProjectMaterial,
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

  it("keeps playbook revisions and can restore an older snapshot", async () => {
    const store = new LocalStore(await createTempDataDir());
    const created = await saveContentPlaybook({
      name: "版本规则",
      productName: "蜂蜜露",
      forbiddenTerms: ["封神"],
      sensitiveClaims: ["治疗"]
    }, undefined, store);
    await saveContentPlaybook({
      name: "版本规则",
      productName: "蜂蜜露",
      forbiddenTerms: ["闭眼冲"],
      sensitiveClaims: ["通便特效"]
    }, created.id, store);

    const revisions = await listContentPlaybookRevisions(created.id, store);
    expect(revisions).toHaveLength(2);
    expect(revisions[0]?.snapshot.forbiddenTerms).toEqual(["闭眼冲"]);
    expect(revisions[1]?.snapshot.forbiddenTerms).toEqual(["封神"]);

    const restored = await restoreContentPlaybookRevision(created.id, revisions[1]!.id, store);
    expect(restored.forbiddenTerms).toEqual(["封神"]);
    expect(restored.sensitiveClaims).toEqual(["治疗"]);
    expect(await listContentPlaybookRevisions(created.id, store)).toHaveLength(3);

    await deleteContentPlaybook(created.id, store);
    expect(await listContentPlaybookRevisions(created.id, store)).toEqual([]);
  });

  it("stores content projects and links drafts and reviews to the selected project", async () => {
    const store = new LocalStore(await createTempDataDir());
    const playbook = await saveContentPlaybook({ name: "项目规则", productName: "蜂蜜露", forbiddenTerms: ["封神"], sensitiveClaims: ["治疗"] }, undefined, store);
    const project = await saveContentProject({
      name: "蜂蜜露种草项目",
      productName: "蜂蜜露",
      targetAudience: ["孕妈"],
      scenarios: ["出门携带"],
      goals: ["生成多篇种草笔记"],
      playbookId: playbook.id,
      status: "writing"
    }, undefined, store);

    expect((await listContentProjects(store)).map((item) => item.id)).toEqual([project.id]);

    const draftResult = await generateContentDraft({
      projectId: project.id,
      brief: {
        productName: "蜂蜜露",
        persona: "孕妈",
        painPoint: "出门不方便",
        scenario: "出门携带",
        channel: "朋友推荐",
        sellingPoints: ["掌心大小"],
        tone: "真实分享",
        length: "short",
        keywords: ["日常分享"]
      }
    }, store);

    expect(draftResult.draft.projectId).toBe(project.id);
    expect(draftResult.review.projectId).toBe(project.id);

    const reviewResult = await reviewContentDraft({
      projectId: project.id,
      body: "这个产品封神了，但我想改得自然一点。"
    }, store);

    expect(reviewResult.review.projectId).toBe(project.id);
    await deleteContentProject(project.id, store);
    expect(await listContentProjects(store)).toEqual([]);
  });

  it("adds selected notes to a project material pool", async () => {
    const store = new LocalStore(await createTempDataDir());
    const project = await saveContentProject({ name: "素材项目", productName: "蜂蜜露" }, undefined, store);
    await store.write("notes", [{
      id: "note_material_1",
      jobIds: ["job_1"],
      keywords: ["孕期好物"],
      title: "孕妈出门携带",
      desc: "出门带着比较方便，放包里不占地方。",
      type: "normal",
      webUrl: "https://example.com/note",
      noteUrl: "https://example.com/note",
      authorName: "运营样本",
      likedCount: 120,
      collectedCount: 30,
      commentCount: 12,
      shareCount: 3,
      hotScore: 200,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z"
    }]);

    const materials = await addContentProjectMaterialsFromNotes(project.id, ["note_material_1"], "scenario", store);
    expect(materials).toHaveLength(1);
    expect(materials[0]).toMatchObject({
      projectId: project.id,
      source: "note",
      sourceId: "note_material_1",
      category: "scenario",
      title: "孕妈出门携带"
    });
    expect((await listContentProjectMaterials(project.id, store))).toHaveLength(1);

    await addContentProjectMaterialsFromNotes(project.id, ["note_material_1"], "scenario", store);
    const latestMaterials = await listContentProjectMaterials(project.id, store);
    expect(latestMaterials).toHaveLength(1);

    await deleteContentProjectMaterial(project.id, latestMaterials[0]!.id, store);
    expect(await listContentProjectMaterials(project.id, store)).toEqual([]);
  });

  it("generates multiple project drafts from material angles", async () => {
    const store = new LocalStore(await createTempDataDir());
    const project = await saveContentProject({
      name: "批量写作项目",
      productName: "蜂蜜露",
      targetAudience: ["孕妈", "上班族"],
      scenarios: ["出门携带", "办公室"],
      goals: ["多角度种草"]
    }, undefined, store);
    await saveContentProjectMaterial({
      projectId: project.id,
      source: "manual",
      category: "scenario",
      title: "包里备用",
      content: "用户在出门时希望小巧、不占包。"
    }, store);

    const result = await generateContentDraftBatch({
      projectId: project.id,
      count: 2,
      brief: {
        productName: "蜂蜜露",
        persona: "孕妈",
        painPoint: "出门不方便",
        scenario: "出门携带",
        channel: "朋友推荐",
        sellingPoints: ["掌心大小"],
        tone: "真实分享",
        length: "short",
        keywords: ["日常分享"]
      }
    }, store);

    expect(result.results).toHaveLength(2);
    expect(result.results.every((item) => item.draft.projectId === project.id)).toBe(true);
    expect(await store.read("contentDrafts")).toHaveLength(2);
    expect(await store.read("contentReviews")).toHaveLength(2);
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

  it("accepts a reviewed draft as the finalized version", async () => {
    const store = new LocalStore(await createTempDataDir());
    const result = await generateContentDraft({
      brief: {
        productName: "蜂蜜露",
        persona: "孕妈",
        painPoint: "出门不方便",
        scenario: "出门携带",
        channel: "朋友推荐",
        sellingPoints: ["掌心大小"],
        tone: "真实分享",
        length: "short",
        keywords: ["日常分享"]
      }
    }, store);

    const accepted = await acceptContentDraftReview(result.draft.id, result.review.id, store);
    expect(accepted.status).toBe("finalized");
    expect(accepted.title).toBe(result.review.revisedTitle);
    expect(accepted.body).toBe(result.review.revisedBody);
    expect((await store.read("contentDrafts"))[0]?.status).toBe("finalized");
  });
});

function createTempDataDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "xhs-content-studio-"));
}
