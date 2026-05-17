import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { anthropicOmitsTemperature, buildAnthropicMessagesBody } from "./anthropic-params";

describe("anthropicOmitsTemperature", () => {
  it("omits temperature for Claude 4 family models", () => {
    assert.equal(anthropicOmitsTemperature("claude-sonnet-4-20250514"), true);
    assert.equal(anthropicOmitsTemperature("claude-opus-4-7"), true);
    assert.equal(anthropicOmitsTemperature("claude-sonnet-4-6"), true);
  });

  it("allows temperature for Claude 3.x models", () => {
    assert.equal(anthropicOmitsTemperature("claude-3-5-sonnet-20241022"), false);
    assert.equal(anthropicOmitsTemperature("claude-3-haiku-20240307"), false);
  });
});

describe("buildAnthropicMessagesBody", () => {
  it("includes temperature only when the model supports it", () => {
    const withTemp = buildAnthropicMessagesBody(
      { system: "sys", user: "user" },
      { model: "claude-3-5-sonnet-20241022", temperature: 0.2 },
    );
    assert.equal(withTemp.temperature, 0.2);

    const withoutTemp = buildAnthropicMessagesBody(
      { system: "sys", user: "user" },
      { model: "claude-sonnet-4-20250514", temperature: 0.2 },
    );
    assert.equal(withoutTemp.temperature, undefined);
  });
});
