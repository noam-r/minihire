import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { parseValidationModelOutput } from "../shared/schemas";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../test/fixtures/validation");

describe("normalizeValidationModelJson", () => {
  it("parses messy LLM-shaped JSON after normalization", () => {
    const raw = readFileSync(join(fixtureDir, "messy-llm-output.json"), "utf8");
    const parsed = parseValidationModelOutput(raw);

    assert.equal(typeof parsed.candidateSummary, "string");
    assert.ok(parsed.candidateSummary.includes("Backend engineer"));
    assert.equal(parsed.requirementMatches.length, 2);
    assert.equal(parsed.requirementMatches[0]?.requirementType, "required");
    assert.equal(parsed.requirementMatches[0]?.judgement, "supported");
    assert.equal(parsed.requirementMatches[0]?.reasoning, "Sustained Go usage in recent roles.");
    assert.equal(parsed.requirementMatches[0]?.evidence.length, 1);
    assert.equal(parsed.requirementMatches[0]?.evidence[0]?.quoteOrSummary, "Built production services in Go for 4 years");
    assert.equal(parsed.requirementMatches[1]?.requirementType, "nice_to_have");
    assert.equal(parsed.requirementMatches[1]?.evidence.length, 1);
    assert.equal(parsed.overall.recruiterSummary, "Promising backend profile; verify GraphQL in interview.");
    assert.ok(parsed.overall.confidenceRationale.includes("GraphQL"));
  });
});
