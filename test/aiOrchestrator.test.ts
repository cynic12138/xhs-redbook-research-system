import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AiArtifact, AiWorkflowKey, NoteRecord, SearchJob, SearchJobInput } from "../src/shared/types.js";
import { LocalStore } from "../src/server/storage/localStore.js";
import {
  createAiOrchestration,
  getAiOrchestration,
  listAiOrchestrations,
  quiesceAiOrchestrations,
  resumeAiOrchestrationScheduling,
  runAiOrchestration,
  startAiOrchestration
} from "../src/server/services/aiOrchestratorService.js";

describe("AI orchestrator service", () => {
  it("creates a controlled orchestration session from an explicit keyword instruction", async () => {
    const store = new LocalStore(await createTempDataDir());

    const orchestration = await createAiOrchestration(
      {
        instruction: "帮我抓取关键词 武汉相亲，然后基于笔记生成话题机会、爆款结构、评论需求、可执行选题",
        modelId: "model1"
      },
      store,
      { autoStart: false }
    );

    expect(orchestration.id).toMatch(/^orch_/);
    expect(orchestration.instruction).toContain("武汉相亲");
    expect(orchestration.keywords).toEqual(["武汉相亲"]);
    expect(orchestration.modelId).toBe("model1");
    expect(orchestration.jobId).toBeUndefined();
    expect(orchestration.status).toBe("queued");
    expect(orchestration.artifactIds).toEqual([]);
    expect(orchestration.steps.map((step) => step.key)).toEqual([
      "create-search-job",
      "wait-notes",
      "run-content-planning",
      "run-viral-template",
      "run-audience-insight",
      "summarize"
    ]);
    expect(orchestration.steps.every((step) => step.status === "pending")).toBe(true);
    expect(await listAiOrchestrations(store)).toHaveLength(1);
    expect(await getAiOrchestration(orchestration.id, store)).toEqual(orchestration);
    expect(await store.read("searchJobs")).toEqual([]);
  });

  it("uses explicit keyword arrays without guessing from free text", async () => {
    const store = new LocalStore(await createTempDataDir());

    const orchestration = await createAiOrchestration(
      {
        instruction: "开始受控编排",
        keywords: [" 开塞露 ", "开塞露", "便秘护理"]
      },
      store,
      { autoStart: false }
    );

    expect(orchestration.keywords).toEqual(["开塞露", "便秘护理"]);
  });

  it("rejects orchestration creation when no clear keyword is present", async () => {
    const store = new LocalStore(await createTempDataDir());

    await expect(createAiOrchestration({ instruction: "帮我做一个完整分析" }, store)).rejects.toThrow("请提供明确关键词");
    expect(await listAiOrchestrations(store)).toEqual([]);
  });

  it("runs the controlled orchestration steps in serial and stores a summary artifact", async () => {
    const store = new LocalStore(await createTempDataDir());
    const workflowOrder: AiWorkflowKey[] = [];
    const orchestration = await createAiOrchestration(
      {
        instruction: "帮我抓取关键词 开塞露，然后生成话题机会、爆款结构、评论需求",
        modelId: "model1"
      },
      store,
      { autoStart: false }
    );

    const finished = await runAiOrchestration(orchestration.id, store, {
      pollMs: 0,
      waitTimeoutMs: 50,
      sleep: async () => undefined,
      createJob: async (input: SearchJobInput) => {
        expect(input.keywords).toEqual(["开塞露"]);
        await store.update("searchJobs", (jobs) => [job(input), ...jobs]);
        await store.update("notes", (notes) => [note(), ...notes]);
        return job(input);
      },
      getJob: async () => job({ keywords: ["开塞露"], sort: "popular", noteType: "all", pages: 1, commentPages: 1, concurrency: 2 }),
      runWorkflow: async (input) => {
        workflowOrder.push(input.workflowKey);
        const artifact = aiArtifact(input.workflowKey, input.jobId, input.modelId);
        await store.update("aiArtifacts", (artifacts) => [artifact, ...artifacts]);
        return artifact;
      }
    });

    expect(finished.status).toBe("completed");
    expect(finished.jobId).toBe("job1");
    expect(workflowOrder).toEqual(["content-planning", "viral-template", "audience-insight"]);
    expect(finished.artifactIds).toHaveLength(4);
    expect(finished.steps.every((step) => step.status === "completed")).toBe(true);

    const artifacts = await store.read("aiArtifacts");
    expect(artifacts.some((artifact) => artifact.title === "AI 编排汇总 - 开塞露")).toBe(true);
  });

  it("records workflow failure on the current session step", async () => {
    const store = new LocalStore(await createTempDataDir());
    const orchestration = await createAiOrchestration(
      { instruction: "帮我抓取关键词 开塞露，然后生成分析" },
      store,
      { autoStart: false }
    );

    const finished = await runAiOrchestration(orchestration.id, store, {
      pollMs: 0,
      waitTimeoutMs: 50,
      sleep: async () => undefined,
      createJob: async (input) => {
        await store.update("searchJobs", (jobs) => [job(input), ...jobs]);
        await store.update("notes", (notes) => [note(), ...notes]);
        return job(input);
      },
      getJob: async () => job({ keywords: ["开塞露"], sort: "popular", noteType: "all", pages: 1, commentPages: 1, concurrency: 2 }),
      runWorkflow: async () => ({
        ...aiArtifact("content-planning", "job1"),
        status: "failed",
        error: "model timeout"
      })
    });

    expect(finished.status).toBe("failed");
    expect(finished.error).toContain("model timeout");
    expect(finished.steps.find((step) => step.key === "run-content-planning")?.status).toBe("failed");
    expect(finished.steps.find((step) => step.key === "run-content-planning")?.error).toContain("model timeout");
  });

  it("waits for the real orchestration runner and blocks new automatic runs while restoring", async () => {
    const store = new LocalStore(await createTempDataDir());
    const orchestration = await createAiOrchestration(
      { instruction: "帮我抓取关键词 开塞露，然后生成分析" },
      store,
      { autoStart: false }
    );
    let release!: () => void;
    let started!: () => void;
    const didStart = new Promise<void>((resolve) => {
      started = resolve;
    });

    startAiOrchestration(orchestration.id, store, {
      createJob: async (input) => {
        started();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        const created = job(input);
        await store.update("searchJobs", (jobs) => [created, ...jobs]);
        await store.update("notes", (notes) => [note(), ...notes]);
        return created;
      },
      getJob: async () => job({ keywords: ["开塞露"], sort: "popular", noteType: "all", pages: 1, commentPages: 1, concurrency: 2 }),
      runWorkflow: async (input) => aiArtifact(input.workflowKey, input.jobId, input.modelId),
      pollMs: 0,
      waitTimeoutMs: 50,
      sleep: async () => undefined
    });
    await didStart;

    try {
      const quiescing = quiesceAiOrchestrations(1_000);
      await expect(createAiOrchestration(
        { instruction: "帮我抓取关键词 便秘护理，然后生成分析" },
        store
      )).rejects.toThrow("准备数据恢复");
      release();
      await expect(quiescing).resolves.toBeUndefined();
    } finally {
      release?.();
      resumeAiOrchestrationScheduling();
    }
  });
});

function createTempDataDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "xhs-orchestrator-"));
}

function job(input: SearchJobInput): SearchJob {
  return {
    id: "job1",
    keywords: input.keywords,
    sort: input.sort,
    noteType: input.noteType,
    pages: input.pages,
    commentPages: input.commentPages,
    concurrency: input.concurrency,
    status: "completed",
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z",
    progress: { seeded: 1, pending: 0, running: 0, done: 1, error: 0, total: 1 }
  };
}

function note(): NoteRecord {
  return {
    id: "note1",
    jobIds: ["job1"],
    keywords: ["开塞露"],
    title: "开塞露使用指南",
    desc: "正确使用方法",
    type: "normal",
    webUrl: "https://www.xiaohongshu.com/explore/note1?xsec_token=t",
    noteUrl: "https://www.xiaohongshu.com/explore/note1",
    likedCount: 100,
    collectedCount: 50,
    commentCount: 10,
    shareCount: 2,
    hotScore: 222,
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z"
  };
}

function aiArtifact(workflowKey: AiWorkflowKey, jobId?: string, modelId?: string): AiArtifact {
  return {
    id: `artifact-${workflowKey}`,
    workflowKey,
    jobId,
    title: `artifact ${workflowKey}`,
    markdown: `# ${workflowKey}`,
    source: "local",
    status: "completed",
    modelId,
    promptKey: workflowKey,
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z"
  };
}
