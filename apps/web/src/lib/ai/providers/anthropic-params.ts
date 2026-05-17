/**
 * Claude 4+ and other reasoning models return 400 if `temperature` is sent.
 * Older Claude 3.x models still accept it.
 */
export function anthropicOmitsTemperature(model: string): boolean {
  const id = model.toLowerCase().trim();
  if (!id) {
    return true;
  }

  // e.g. claude-sonnet-4-20250514, claude-opus-4-7, claude-sonnet-4-6
  if (/claude-(opus|sonnet|haiku)-4(?:-|$)/.test(id)) {
    return true;
  }

  // e.g. claude-4-sonnet (aliases)
  if (/claude-4/.test(id)) {
    return true;
  }

  return false;
}

export function buildAnthropicMessagesBody(
  input: { system: string; user: string },
  config: { model: string; temperature?: number },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 8192,
    system: `${input.system}\n\nRespond with a single valid JSON object only. No markdown fences.`,
    messages: [{ role: "user", content: input.user }],
  };

  if (!anthropicOmitsTemperature(config.model) && config.temperature != null) {
    body.temperature = config.temperature;
  }

  return body;
}
