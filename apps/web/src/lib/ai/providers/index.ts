import type { AiConfig } from "../config";
import { createAnthropicProvider } from "./anthropic";
import { createOpenAiProvider } from "./openai";
import type { AiCompletionInput, AiCompletionOutput } from "./types";

export function createAiProvider(config: AiConfig) {
  if (config.provider === "openai") {
    return createOpenAiProvider(config);
  }
  return createAnthropicProvider(config);
}

export async function completeJson(
  config: AiConfig,
  input: AiCompletionInput,
): Promise<AiCompletionOutput> {
  const provider = createAiProvider(config);
  return provider.completeJson(input);
}

export type { AiCompletionInput, AiCompletionOutput } from "./types";
