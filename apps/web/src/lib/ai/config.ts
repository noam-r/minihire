import { runtimeEnv } from "../server-env";

export type AiProviderName = "openai" | "anthropic";

export type AiConfig = {
  enabled: boolean;
  provider: AiProviderName;
  apiKey: string;
  model: string;
  maxCvChars: number;
};

const DEFAULT_MAX_CV_CHARS = 60_000;

export function getAiConfig(): AiConfig | null {
  const enabled = runtimeEnv("AI_ENABLED") === "true";
  if (!enabled) {
    return null;
  }

  const provider = runtimeEnv("AI_PROVIDER");
  if (provider !== "openai" && provider !== "anthropic") {
    throw new Error('AI_ENABLED=true requires AI_PROVIDER to be "openai" or "anthropic"');
  }

  const apiKey = runtimeEnv("AI_API_KEY");
  if (!apiKey) {
    throw new Error("AI_ENABLED=true requires AI_API_KEY");
  }

  const model = runtimeEnv("AI_MODEL");
  if (!model) {
    throw new Error("AI_ENABLED=true requires AI_MODEL");
  }

  const maxCvRaw = runtimeEnv("AI_MAX_CV_CHARS");
  const maxCvChars = maxCvRaw ? Number.parseInt(maxCvRaw, 10) : DEFAULT_MAX_CV_CHARS;
  if (!Number.isFinite(maxCvChars) || maxCvChars < 1) {
    throw new Error("AI_MAX_CV_CHARS must be a positive integer");
  }

  return { enabled: true, provider, apiKey, model, maxCvChars };
}

export function requireAiConfig(): AiConfig {
  const config = getAiConfig();
  if (!config) {
    throw new Error("AI evaluation is disabled (set AI_ENABLED=true and provider credentials)");
  }
  return config;
}
