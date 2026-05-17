import type { AiConfig } from "../config";
import { AiProviderError } from "../shared/errors";
import { buildAnthropicMessagesBody } from "./anthropic-params";
import type { AiCompletionInput, AiCompletionOutput, AiProvider } from "./types";

export function createAnthropicProvider(config: AiConfig): AiProvider {
  return {
    name: "anthropic",
    async completeJson(input: AiCompletionInput): Promise<AiCompletionOutput> {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildAnthropicMessagesBody(input, { model: config.model, temperature: 0.2 }),
        ),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AiProviderError(
          "anthropic",
          `Anthropic API ${response.status}: ${body.slice(0, 500)}`,
        );
      }

      const data = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const text = data.content?.find((block) => block.type === "text")?.text;
      if (!text) {
        throw new AiProviderError("anthropic", "Anthropic returned empty content");
      }

      return {
        text,
        model: config.model,
        provider: "anthropic",
        usage: {
          inputTokens: data.usage?.input_tokens,
          outputTokens: data.usage?.output_tokens,
        },
      };
    },
  };
}
