import type { AiConfig } from "../config";
import { AiProviderError } from "../shared/errors";
import type { AiCompletionInput, AiCompletionOutput, AiProvider } from "./types";

export function createOpenAiProvider(config: AiConfig): AiProvider {
  return {
    name: "openai",
    async completeJson(input: AiCompletionInput): Promise<AiCompletionOutput> {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AiProviderError("openai", `OpenAI API ${response.status}: ${body.slice(0, 500)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new AiProviderError("openai", "OpenAI returned empty content");
      }

      return {
        text,
        model: config.model,
        provider: "openai",
        usage: {
          inputTokens: data.usage?.prompt_tokens,
          outputTokens: data.usage?.completion_tokens,
        },
      };
    },
  };
}
