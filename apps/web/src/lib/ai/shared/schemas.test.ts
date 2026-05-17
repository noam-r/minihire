import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { AiValidationParseError } from "./errors";
import { parseValidationModelOutput } from "./schemas";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../test/fixtures/validation");

describe("parseValidationModelOutput", () => {
  it("parses valid fixture JSON", () => {
    const parsed = parseValidationModelOutput(readFileSync(join(fixtureDir, "valid-output.json"), "utf8"));
    assert.equal(parsed.requirementMatches.length, 2);
    assert.equal(parsed.overall.confidence, "medium");
    assert.ok(parsed.overall.confidenceRationale.includes("Go"));
  });

  it("rejects invalid judgement values", () => {
    assert.throws(
      () =>
        parseValidationModelOutput(
          JSON.stringify({
            candidateSummary: "x",
            requirementMatches: [
              {
                requirement: "Go",
                requirementType: "required",
                judgement: "invalid",
                confidence: "high",
                evidence: [],
                gaps: [],
                suggestedScore: 3,
                reasoning: "r",
              },
            ],
            overall: {
              strengths: [],
              gaps: [],
              concerns: [],
              suggestedInterviewQuestions: [],
              recruiterSummary: "s",
              confidence: "high",
              confidenceRationale: "Strong evidence across requirements.",
            },
          }),
        ),
      AiValidationParseError,
    );
  });

  it("rejects overall without confidenceRationale", () => {
    assert.throws(
      () =>
        parseValidationModelOutput(
          JSON.stringify({
            candidateSummary: "x",
            requirementMatches: [],
            overall: {
              strengths: [],
              gaps: [],
              concerns: [],
              suggestedInterviewQuestions: [],
              recruiterSummary: "s",
              confidence: "high",
            },
          }),
        ),
      AiValidationParseError,
    );
  });
});
