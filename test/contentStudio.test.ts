import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalStore } from "../src/server/storage/localStore.js";
import {
  acceptContentDraftReview,
  addContentProjectMaterialsFromNotes,
  generateContentDraft,
  generateContentDraftBatch,
  getContentPlaybookStats,
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
import {
  WEEK_FIFTEEN_HONEY_DEW_DEFAULT_PLAYBOOK_ID,
  WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME,
  WEEK_FIFTEEN_HONEY_DEW_PROMPT_VERSION
} from "../src/shared/contentReviewPolicy.js";

describe("content studio service", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the specialty default instead of the first saved playbook and performs the local review", async () => {
    const store = new LocalStore(await createTempDataDir());
    const saved = await saveContentPlaybook({
      name: "旧规则",
      productName: "其他产品",
      forbiddenTerms: [],
      sensitiveClaims: []
    }, undefined, store);

    const result = await reviewContentDraft({
      body: "周十五蜂露闭眼冲，治疗、百分百好用，还吊打竞品不行。"
    }, store);

    expect(result.review.playbookId).toBe(WEEK_FIFTEEN_HONEY_DEW_DEFAULT_PLAYBOOK_ID);
    expect(result.review.playbookId).not.toBe(saved.id);
    expect(result.review.revisedBody).toContain(WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME);
    expect(result.review.revisedBody).not.toContain("周十五蜂露");
    expect(result.review.issues.map((issue) => issue.category)).toEqual(expect.arrayContaining([
      "广告话术", "敏感功效", "绝对化表达", "竞品贬低"
    ]));
    expect(result.artifact.promptVersion).toBe(WEEK_FIFTEEN_HONEY_DEW_PROMPT_VERSION);
    expect(result.artifact.markdown).toContain("## 可直接复制的最小修改版");
    expect(result.artifact.markdown).toContain("标题：");
    expect(result.artifact.markdown).toContain("内容：");
  });

  it("preserves missing titles and tags instead of inventing them during local fallback", async () => {
    const store = new LocalStore(await createTempDataDir());

    const result = await reviewContentDraft({
      body: "周十五蜂露闭眼冲。"
    }, store);

    expect(result.review.issues.map((issue) => issue.category)).toEqual(expect.arrayContaining(["格式缺失", "标签缺失"]));
    expect(result.review.revisedTitle).toBe("");
    expect(result.review.revisedTags).toEqual([]);
  });

  it("scans and removes generic competitor terms in an explicit disparagement context", async () => {
    const store = new LocalStore(await createTempDataDir());
    const playbook = await saveContentPlaybook({
      name: "蜂蜜露竞品规则",
      productName: WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME,
      forbiddenTerms: [],
      sensitiveClaims: [],
      replacements: []
    }, undefined, store);

    const result = await reviewContentDraft({
      playbookId: playbook.id,
      body: "其他开塞露刺激、垃圾，但这款入口没有刺激感。"
    }, store);
    const secondScan = scanContentDraft({
      title: result.review.revisedTitle,
      body: result.review.revisedBody,
      tags: result.review.revisedTags
    }, playbook);

    expect(result.review.issues.filter((issue) => issue.category === "竞品贬低")).toHaveLength(2);
    expect(result.review.revisedBody).toBe("同类产品的使用感受因人而异，但这款入口没有刺激感。");
    expect(result.review.revisedBody).not.toContain("其他开塞露、。");
    expect(result.review.revisedBody).not.toContain("其他开塞露刺激");
    expect(result.review.revisedBody).not.toContain("垃圾");
    expect(secondScan.issues.some((issue) => issue.category === "竞品贬低")).toBe(false);
  });

  it("keeps generic competitor words when no disparagement context exists", async () => {
    const store = new LocalStore(await createTempDataDir());

    const result = await reviewContentDraft({
      body: "其他饮料也会刺激味蕾，但这款入口没有刺激感。"
    }, store);

    expect(result.review.issues.some((issue) => issue.category === "竞品贬低")).toBe(false);
    expect(result.review.revisedBody).toBe("其他饮料也会刺激味蕾，但这款入口没有刺激感。");
  });

  it("recognizes negation with modifiers before a contextual competitor term", async () => {
    const store = new LocalStore(await createTempDataDir());

    const result = await reviewContentDraft({
      body: "其他产品没有明显的刺激感，并没有任何刺激感。"
    }, store);

    expect(result.review.issues.some((issue) => issue.category === "竞品贬低")).toBe(false);
    expect(result.review.revisedBody).toBe("其他产品没有明显的刺激感，并没有任何刺激感。");
  });

  it("replaces overlapping sensitive phrases before shorter terms and leaves a clean second scan", async () => {
    const store = new LocalStore(await createTempDataDir());
    const playbook = await saveContentPlaybook({
      name: "蜂蜜露短语规则",
      productName: WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME,
      forbiddenTerms: [],
      sensitiveClaims: [],
      replacements: []
    }, undefined, store);

    const result = await reviewContentDraft({
      playbookId: playbook.id,
      title: "真实体验",
      body: "它不是通便特效药，也不能让人告别便秘永久不复发，更不是百分百好用。",
      tags: ["日常分享"]
    }, store);
    const secondScan = scanContentDraft({
      title: result.review.revisedTitle,
      body: result.review.revisedBody,
      tags: result.review.revisedTags
    }, playbook);

    for (const residue of ["通便特效药", "通便药", "告别便秘", "永久不复发", "百分百好用", "百分百"]) {
      expect(result.review.revisedBody).not.toContain(residue);
    }
    expect(result.review.revisedBody).toBe("这些只是我的个人使用感受，不能当成功效承诺。");
    for (const brokenPhrase of ["不是对我来说", "让人这是", "不是我个人"]) {
      expect(result.review.revisedBody).not.toContain(brokenPhrase);
    }
    expect(secondScan.issues.some((issue) => issue.category === "敏感功效" || issue.category === "绝对化表达")).toBe(false);
  });

  it("keeps unrelated facts when negation is not bound to the sensitive phrase", async () => {
    const store = new LocalStore(await createTempDataDir());

    const result = await reviewContentDraft({
      body: "我不是孕妈，但它是通便特效药，平时放包里很方便。"
    }, store);

    expect(result.review.revisedBody).toBe("我不是孕妈，但实际使用感受因人而异，平时放包里很方便。");
    expect(result.review.revisedBody).not.toContain("通便特效药");
    expect(result.review.revisedBody).not.toContain("是对我来说");
    expect(result.review.revisedBody).not.toContain("是我个人");
  });

  it("preserves safe facts after competitor-disparagement contrast boundaries", async () => {
    const store = new LocalStore(await createTempDataDir());

    for (const contrast of ["但", "不过", "然而", "可是"]) {
      const result = await reviewContentDraft({
        body: `其他开塞露刺激${contrast}包装小巧。`
      }, store);

      expect(result.review.revisedBody).toBe(`同类产品的使用感受因人而异${contrast}包装小巧。`);
      expect(result.review.revisedBody).not.toContain("其他开塞露刺激");
    }
  });

  it("constrains AI review output to the original title and tags while correcting the product name", async () => {
    const store = new LocalStore(await createTempDataDir());
    await store.write("aiModels", [{
      id: "review-model",
      name: "审稿模型",
      provider: "test",
      baseUrl: "https://example.test",
      model: "review-model",
      apiKeyMasked: "***",
      hasApiKey: true,
      isDefault: true,
      temperature: 0,
      maxTokens: 100,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z"
    }]);
    vi.stubEnv("AI_MODEL_REVIEW_MODEL_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          title: "凭空标题 周十五蜂露",
          body: "周十五蜂露可以按需求看看。",
          tags: ["新增标签", "重复", "周十五蜂露"]
        }) } }]
      })
    }));

    const result = await reviewContentDraft({
      body: "周十五蜂露可以按需求看看。",
      tags: ["周十五蜂露", "封神", "闭眼冲", "重复", "重复"]
    }, store);

    expect(result.review.source).toBe("ai");
    expect(result.review.revisedTitle).toBe("");
    expect(result.review.revisedBody).toContain(WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME);
    expect(result.review.revisedTags).toEqual([WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME, "封神", "闭眼冲", "重复", "重复"]);
    expect(result.artifact.markdown).toContain(`#${WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME} #封神 #闭眼冲 #重复 #重复`);
  });

  it("protects the corrected specialty product from saved full-name and substring replacements", async () => {
    const store = new LocalStore(await createTempDataDir());
    const playbook = await saveContentPlaybook({
      name: "冲突规则",
      productName: WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME,
      forbiddenTerms: [],
      sensitiveClaims: [],
      replacements: [
        { from: "周十五蜂露", to: "其他名称" },
        { from: "周十五", to: "其他名" },
        { from: "蜂蜜露", to: "别的" }
      ]
    }, undefined, store);

    const result = await reviewContentDraft({
      playbookId: playbook.id,
      title: "周十五蜂露标题",
      body: "周十五蜂露适合日常携带。",
      tags: ["周十五蜂露"]
    }, store);

    for (const value of [result.review.revisedTitle, result.review.revisedBody]) {
      expect(value).toContain(WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME);
      expect(value).not.toContain("其他名称");
      expect(value).not.toContain("其他名");
      expect(value).not.toContain("别的");
      expect(value).not.toContain("\uE000");
    }
    expect(result.review.revisedTags).toEqual([WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME]);
  });

  it("does not apply the specialty scan, prompt, or cleanup to an explicit other-product playbook", async () => {
    const store = new LocalStore(await createTempDataDir());
    const playbook = await saveContentPlaybook({
      name: "零食审稿规则",
      productName: "辣味零食",
      forbiddenTerms: [],
      sensitiveClaims: [],
      replacements: []
    }, undefined, store);
    await store.write("aiModels", [{
      id: "other-product-model",
      name: "其他产品模型",
      provider: "test",
      baseUrl: "https://example.test",
      model: "other-product-model",
      apiKeyMasked: "***",
      hasApiKey: true,
      isDefault: true,
      temperature: 0,
      maxTokens: 100,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z"
    }]);
    vi.stubEnv("AI_MODEL_OTHER_PRODUCT_MODEL_KEY", "test-key");
    let requestBody = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      requestBody = String(init?.body ?? "");
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            title: "AI 凭空零食标题",
            body: "刺激味蕾，但没有刺激感。",
            tags: ["AI新增", "AI改序"]
          }) } }]
        })
      };
    }));

    const result = await reviewContentDraft({
      playbookId: playbook.id,
      modelId: "other-product-model",
      body: "刺激味蕾，但没有刺激感。",
      tags: ["原标签", "重复", "重复"]
    }, store);

    expect(result.review.issues.some((issue) => issue.category === "竞品贬低")).toBe(false);
    expect(result.review.revisedTitle).toBe("");
    expect(result.review.revisedBody).toBe("刺激味蕾，但没有刺激感。");
    expect(result.review.revisedTags).toEqual(["原标签", "重复", "重复"]);
    expect(requestBody).not.toContain("专项固定约束");
    expect(requestBody).not.toContain(WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME);
  });

  it("keeps the specialty policy active for a saved playbook with the exact product name", async () => {
    const store = new LocalStore(await createTempDataDir());
    const playbook = await saveContentPlaybook({
      name: "蜂蜜露保存规则",
      productName: WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME,
      forbiddenTerms: [],
      sensitiveClaims: [],
      replacements: []
    }, undefined, store);

    const result = await reviewContentDraft({
      playbookId: playbook.id,
      body: "其他开塞露刺激。"
    }, store);

    expect(result.review.issues.some((issue) => issue.category === "竞品贬低")).toBe(true);
    expect(result.review.revisedBody).not.toContain("刺激");
  });

  it("keeps batch reviews and automatic draft reviews on the specialty default", async () => {
    const store = new LocalStore(await createTempDataDir());
    const batch = await reviewContentDraftBatch({
      items: [{ id: "batch-default", body: "周十五蜂露闭眼冲。" }]
    }, store);
    const draft = await generateContentDraft({
      brief: {
        productName: "周十五蜂露",
        persona: "普通用户",
        painPoint: "日常小困扰",
        scenario: "日常通勤",
        channel: "朋友推荐",
        sellingPoints: ["方便"],
        tone: "真实分享",
        length: "short",
        keywords: []
      }
    }, store);

    expect(batch.reviews[0]?.playbookId).toBe(WEEK_FIFTEEN_HONEY_DEW_DEFAULT_PLAYBOOK_ID);
    expect(draft.review.playbookId).toBe(WEEK_FIFTEEN_HONEY_DEW_DEFAULT_PLAYBOOK_ID);
    expect(draft.artifact.promptVersion).toBe("xhs-content-studio-v1");
  });

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

  it("summarizes playbook rule hit statistics from reviews", async () => {
    const store = new LocalStore(await createTempDataDir());
    const playbook = await saveContentPlaybook({
      name: "统计规则",
      productName: "蜂蜜露",
      forbiddenTerms: ["封神"],
      sensitiveClaims: ["治疗"]
    }, undefined, store);
    await reviewContentDraft({
      playbookId: playbook.id,
      title: "蜂蜜露封神",
      body: "这个产品可以治疗问题。"
    }, store);

    const stats = await getContentPlaybookStats(playbook.id, store);
    expect(stats.reviewCount).toBe(1);
    expect(stats.issueCount).toBeGreaterThan(0);
    expect(stats.highRiskCount).toBe(1);
    expect(stats.topCategories.some((item) => item.category === "敏感功效")).toBe(true);
    expect(stats.recentIssues[0]?.reviewId).toBeTruthy();
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
        { id: "row_1", title: "孕妈好物", body: "这个产品是救命神器，效果拉满。", tags: ["周十五蜂露", "重复", "重复"] },
        { id: "row_2", title: "出门携带", body: "掌心大小，放包里很方便。", tags: ["日常"] }
      ]
    }, store);

    expect(result.reviews).toHaveLength(2);
    expect(result.artifacts).toHaveLength(2);
    expect(result.reviews[0]?.artifactId).toBe(result.artifacts[0]?.id);
    expect(result.reviews[0]?.originalTags).toEqual(["周十五蜂露", "重复", "重复"]);
    expect(result.reviews[0]?.revisedTags).toEqual([WEEK_FIFTEEN_HONEY_DEW_PRODUCT_NAME, "重复", "重复"]);
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
