import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS,
  PB_ARTIFACT_TEXT_STORAGE_MAX_CHARS,
  truncateForLlm,
  truncateForStorage,
} from "./truncate";

describe("truncateForLlm", () => {
  it("caps text at the given character limit", () => {
    const long = "a".repeat(PB_ARTIFACT_TEXT_STORAGE_MAX_CHARS + 100);
    const result = truncateForLlm(long, PB_ARTIFACT_TEXT_STORAGE_MAX_CHARS);
    assert.ok(result.truncated);
    assert.ok(result.text.length <= PB_ARTIFACT_TEXT_STORAGE_MAX_CHARS);
    assert.ok(result.text.length < long.length);
    assert.match(result.text, /\[truncated for model context limit\]$/);
  });
});

describe("truncateForStorage", () => {
  it("caps report markdown within legacy PocketBase limit", () => {
    const long = "# Report\n\n" + "x".repeat(10_000);
    const result = truncateForStorage(long, PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS);
    assert.ok(result.truncated);
    assert.ok(result.text.length <= PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS);
    assert.match(result.text, /\[Truncated for storage\.\]/);
  });
});
