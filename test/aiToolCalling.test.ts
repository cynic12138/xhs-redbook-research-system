import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AiModelConfig } from "../src/shared/types.js";
import { LocalStore } from "../src/server/storage/localStore.js";
import {
  createAiOrchestrationWithToolsFallback,
  parseAiToolCalls,
  sanitizeToolSearchArgs
} from "../src/server/services/aiToolCallingService.js";

describe("AI tool calling compatibility layer", () => {
  it("parses OpenAI-compatible tool calls and rejects non-whitelisted tools", () => {
    const calls = parseAiToolCalls({
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: {
            name: "create_search_job",
            arguments: JSON.stringify({ keywords: ["武汉相亲"], pages: 2, commentPages: 1 })
          }
        }
      ]
    });

    expect(calls).toEqual([
      {
        id: "call_1",
        name: "create_search_job",
        arguments: { keywords: ["武汉相亲"], pages: 2, commentPages: 1 }
      }
    ]);
    expect(sanitizeToolSearchArgs(calls[0].arguments)).toEqual({
      keywords: ["武汉相亲"],
      sort: "popular",
      noteType: "all",
      pages: 2,
      commentPages: 1
    });

    expect(() =>
      parseAiToolCalls({
        tool_calls: [
          {
            id: "call_bad",
            type: "function",
            function: { name: "delete_all_notes", arguments: "{}" }
          }
        ]
      })
    ).toThrow("Unsupported AI tool");
  });

  it("rejects unsupported arguments that could smuggle secrets or unsafe operations", () => {
    expect(() =>
      parseAiToolCalls({
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "create_search_job",
              arguments: JSON.stringify({ keywords: ["武汉相亲"], apiKey: "secret" })
            }
          }
        ]
      })
    ).toThrow("Unsupported argument");
  });

  it("rejects content studio tools that the search orchestrator cannot execute", () => {
    expect(() =>
      parseAiToolCalls({
        tool_calls: [
          {
            id: "call_content",
            type: "function",
            function: {
              name: "review_xhs_draft",
              arguments: JSON.stringify({
                playbookId: "playbook1",
                title: "孕妈分享",
                body: "这是一篇需要审稿的小红书笔记。",
                tags: ["孕期好物"]
              })
            }
          }
        ]
      })
    ).toThrow("Unsupported AI tool");
  });

  it("uses valid tool-call keywords before starting the existing controlled orchestration", async () => {
    const store = new LocalStore(await createTempDataDir());
    await store.write("aiModels", [model()]);

    const orchestration = await createAiOrchestrationWithToolsFallback(
      { instruction: "帮我抓取并分析这个明确需求", modelId: "model1" },
      store,
      {
        autoStart: false,
        getApiKey: () => "test-key",
        fetchImpl: async () => jsonResponse({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_1",
                    type: "function",
                    function: {
                      name: "create_search_job",
                      arguments: JSON.stringify({ keywords: ["武汉相亲"] })
                    }
                  }
                ]
              }
            }
          ]
        })
      }
    );

    expect(orchestration.keywords).toEqual(["武汉相亲"]);
    expect(orchestration.status).toBe("queued");
    expect(await store.read("searchJobs")).toEqual([]);
  });

  it("falls back to the controlled orchestration when model tools are unsupported or malformed", async () => {
    const store = new LocalStore(await createTempDataDir());
    await store.write("aiModels", [model()]);

    const orchestration = await createAiOrchestrationWithToolsFallback(
      {
        instruction: "模型不支持 tools 时也要继续",
        keywords: ["便秘护理"],
        modelId: "model1"
      },
      store,
      {
        autoStart: false,
        getApiKey: () => "test-key",
        fetchImpl: async () => jsonResponse({
          choices: [{ message: { content: "I cannot call tools." } }]
        })
      }
    );

    expect(orchestration.keywords).toEqual(["便秘护理"]);
    expect(orchestration.status).toBe("queued");
    expect(await store.read("aiOrchestrations")).toHaveLength(1);
  });

  it("falls back when the model returns an unsafe tool or a tools API error", async () => {
    const store = new LocalStore(await createTempDataDir());
    await store.write("aiModels", [model()]);

    const unsafe = await createAiOrchestrationWithToolsFallback(
      { instruction: "fallback", keywords: ["安全关键词"], modelId: "model1" },
      store,
      {
        autoStart: false,
        getApiKey: () => "test-key",
        fetchImpl: async () => jsonResponse({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "bad",
                    type: "function",
                    function: { name: "delete_all_notes", arguments: "{}" }
                  }
                ]
              }
            }
          ]
        })
      }
    );
    expect(unsafe.keywords).toEqual(["安全关键词"]);

    const failed = await createAiOrchestrationWithToolsFallback(
      { instruction: "fallback", keywords: ["接口失败"], modelId: "model1" },
      store,
      {
        autoStart: false,
        getApiKey: () => "test-key",
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: "tools unsupported" } })
        })
      }
    );
    expect(failed.keywords).toEqual(["接口失败"]);
  });

  it("probes model tool support without creating jobs or artifacts", async () => {
    const { probeAiModelTools } = await import("../src/server/services/aiToolCallingService.js");
    const store = new LocalStore(await createTempDataDir());
    await store.write("aiModels", [model()]);

    const supported = await probeAiModelTools("model1", store, {
      getApiKey: () => "test-key",
      fetchImpl: async () => jsonResponse({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "create_search_job",
                    arguments: JSON.stringify({ keywords: ["tools-probe"] })
                  }
                }
              ]
            }
          }
        ]
      })
    });
    expect(supported.ok).toBe(true);
    expect(supported.supportsTools).toBe(true);
    expect(await store.read("searchJobs")).toEqual([]);

    const unsupported = await probeAiModelTools("model1", store, {
      getApiKey: () => "test-key",
      fetchImpl: async () => jsonResponse({ choices: [{ message: { content: "no tools" } }] })
    });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.supportsTools).toBe(false);

    const noKey = await probeAiModelTools("model1", store, { getApiKey: () => undefined });
    expect(noKey.ok).toBe(false);
    expect(noKey.supportsTools).toBe(false);
  });
});

function createTempDataDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "xhs-tool-calling-"));
}

function model(): AiModelConfig {
  return {
    id: "model1",
    name: "test-model",
    provider: "OpenAI-compatible",
    baseUrl: "https://example.com/v1",
    model: "test-chat",
    apiKeyMasked: "test...key",
    hasApiKey: true,
    isDefault: true,
    temperature: 0,
    maxTokens: 1000,
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z"
  };
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  };
}
