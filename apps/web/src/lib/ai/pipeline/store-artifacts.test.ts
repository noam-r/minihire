import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS, truncateForStorage } from "../shared/truncate";

describe("storeEvaluationReport text limits", () => {
  it("truncates long recruiter reports to fit legacy PocketBase text fields", () => {
    const longReport = [
      "# AI-Assisted Candidate Evaluation",
      "",
      "## Assessment transparency",
      "",
      "### Confidence rationale",
      "",
      "Evidence is mixed across requirements.",
      "",
      ...Array.from({ length: 200 }, (_, index) => `- Requirement row ${index} with detailed reasoning.`),
    ].join("\n");

    assert.ok(longReport.length > PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS);

    const stored = truncateForStorage(longReport, PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS);
    assert.ok(stored.truncated);
    assert.ok(stored.text.length <= PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS);
  });
});
