export type AiCompletionInput = {
  system: string;
  user: string;
  responseFormat: "json";
};

export type AiCompletionOutput = {
  text: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
};

export type AiProvider = {
  name: string;
  completeJson(input: AiCompletionInput): Promise<AiCompletionOutput>;
};
