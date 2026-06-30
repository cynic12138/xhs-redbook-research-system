import { describe, expect, it } from "vitest";
import { AI_MODEL_PROVIDER_PRESETS, findModelProviderPreset } from "../src/shared/modelProviders.js";

describe("model provider presets", () => {
  it("includes common OpenAI-compatible providers", () => {
    expect(AI_MODEL_PROVIDER_PRESETS.map((preset) => preset.key)).toEqual(
      expect.arrayContaining(["openai", "deepseek", "qwen", "minimax", "doubao", "moonshot", "siliconflow", "xai", "custom"])
    );
  });

  it("recognizes existing DeepSeek-style models even when saved as OpenAI-compatible", () => {
    expect(findModelProviderPreset("OpenAI-compatible", "https://api.openai.com/v1", "deepseek-v4-pro").key).toBe("deepseek");
  });

  it("recognizes providers by base url and model name", () => {
    expect(findModelProviderPreset("OpenAI-compatible", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus").key).toBe("qwen");
    expect(findModelProviderPreset("Moonshot AI", "https://api.moonshot.ai/v1", "kimi-k2-0711-preview").key).toBe("moonshot");
    expect(findModelProviderPreset("OpenAI-compatible", "https://api.x.ai/v1", "grok-4").key).toBe("xai");
  });

  it("keeps unknown OpenAI-compatible gateways as custom", () => {
    expect(findModelProviderPreset("OpenAI-compatible", "https://example.test/v1", "custom-model").key).toBe("custom");
  });
});
