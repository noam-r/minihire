export class AiPipelineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AiPipelineError";
    this.code = code;
  }
}

export class AiValidationParseError extends AiPipelineError {
  constructor(message: string) {
    super("validation_parse_error", message);
    this.name = "AiValidationParseError";
  }
}

export class AiProviderError extends AiPipelineError {
  readonly provider: string;

  constructor(provider: string, message: string) {
    super("provider_error", message);
    this.name = "AiProviderError";
    this.provider = provider;
  }
}
