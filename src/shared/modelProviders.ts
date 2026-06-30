export type AiModelProviderKey =
  | "openai"
  | "deepseek"
  | "qwen"
  | "minimax"
  | "doubao"
  | "moonshot"
  | "siliconflow"
  | "xai"
  | "custom";

export interface AiModelProviderPreset {
  key: AiModelProviderKey;
  name: string;
  provider: string;
  baseUrl: string;
  modelPlaceholder: string;
  description: string;
  apiKeyHint: string;
  regionOptions?: Array<{
    label: string;
    baseUrl: string;
  }>;
}

export const AI_MODEL_PROVIDER_PRESETS: AiModelProviderPreset[] = [
  {
    key: "openai",
    name: "OpenAI",
    provider: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelPlaceholder: "gpt-4.1-mini",
    description: "OpenAI 官方 API。",
    apiKeyHint: "OpenAI API Key"
  },
  {
    key: "deepseek",
    name: "DeepSeek",
    provider: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    modelPlaceholder: "deepseek-chat",
    description: "DeepSeek 兼容 OpenAI 的 API。",
    apiKeyHint: "DeepSeek API Key"
  },
  {
    key: "qwen",
    name: "Qwen",
    provider: "Qwen / DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelPlaceholder: "qwen-plus",
    description: "阿里云百炼 DashScope 兼容 OpenAI 的 API。",
    apiKeyHint: "DashScope API Key",
    regionOptions: [
      { label: "China mainland", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
      { label: "International", baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" }
    ]
  },
  {
    key: "minimax",
    name: "MiniMax",
    provider: "MiniMax",
    baseUrl: "https://api.minimax.io/v1",
    modelPlaceholder: "MiniMax-M1",
    description: "MiniMax 兼容 OpenAI 的 API。",
    apiKeyHint: "MiniMax API Key"
  },
  {
    key: "doubao",
    name: "Doubao",
    provider: "Volcengine Ark",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    modelPlaceholder: "doubao-seed-1-6-250615",
    description: "火山引擎方舟兼容 OpenAI 的 API。",
    apiKeyHint: "Volcengine Ark API Key"
  },
  {
    key: "moonshot",
    name: "Kimi",
    provider: "Moonshot AI",
    baseUrl: "https://api.moonshot.ai/v1",
    modelPlaceholder: "kimi-k2-0711-preview",
    description: "Moonshot/Kimi 兼容 OpenAI 的 API。",
    apiKeyHint: "Moonshot API Key"
  },
  {
    key: "siliconflow",
    name: "SiliconFlow",
    provider: "SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    modelPlaceholder: "Qwen/Qwen3-32B",
    description: "SiliconFlow 兼容 OpenAI 的 API。",
    apiKeyHint: "SiliconFlow API Key"
  },
  {
    key: "xai",
    name: "xAI",
    provider: "xAI",
    baseUrl: "https://api.x.ai/v1",
    modelPlaceholder: "grok-4",
    description: "xAI 兼容 OpenAI 的 API。",
    apiKeyHint: "xAI API Key"
  },
  {
    key: "custom",
    name: "Custom",
    provider: "OpenAI-compatible",
    baseUrl: "https://api.openai.com/v1",
    modelPlaceholder: "model-name",
    description: "使用任意兼容 OpenAI 的网关或自定义接口地址。",
    apiKeyHint: "API Key"
  }
];

export function findModelProviderPreset(provider: string, baseUrl: string, model = ""): AiModelProviderPreset {
  const providerText = provider.toLowerCase();
  const baseUrlText = baseUrl.toLowerCase();
  const modelText = model.toLowerCase();
  if (modelText.includes("deepseek")) {
    return AI_MODEL_PROVIDER_PRESETS.find((preset) => preset.key === "deepseek") ?? AI_MODEL_PROVIDER_PRESETS[0];
  }
  if (modelText.includes("qwen")) {
    return AI_MODEL_PROVIDER_PRESETS.find((preset) => preset.key === "qwen") ?? AI_MODEL_PROVIDER_PRESETS[0];
  }
  if (modelText.includes("kimi") || modelText.includes("moonshot")) {
    return AI_MODEL_PROVIDER_PRESETS.find((preset) => preset.key === "moonshot") ?? AI_MODEL_PROVIDER_PRESETS[0];
  }
  if (modelText.includes("doubao")) {
    return AI_MODEL_PROVIDER_PRESETS.find((preset) => preset.key === "doubao") ?? AI_MODEL_PROVIDER_PRESETS[0];
  }
  if (modelText.includes("minimax")) {
    return AI_MODEL_PROVIDER_PRESETS.find((preset) => preset.key === "minimax") ?? AI_MODEL_PROVIDER_PRESETS[0];
  }
  const baseUrlMatched = AI_MODEL_PROVIDER_PRESETS.find((preset) => {
    if (preset.key === "custom") return false;
    return baseUrlText.startsWith(preset.baseUrl.toLowerCase());
  });
  if (baseUrlMatched) {
    return baseUrlMatched;
  }
  return (
    AI_MODEL_PROVIDER_PRESETS.find((preset) => {
      if (preset.key === "custom") return false;
      if (preset.key === "openai") {
        return providerText === "openai";
      }
      return providerText.includes(preset.provider.toLowerCase());
    }) ?? AI_MODEL_PROVIDER_PRESETS[AI_MODEL_PROVIDER_PRESETS.length - 1]
  );
}
