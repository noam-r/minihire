import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ValidationModelOutput } from "../shared/types";
import { ensureRequirementCoverage } from "./ensure-requirement-coverage";

describe("ensureRequirementCoverage", () => {
  it("adds missing nice-to-have rows when the model only returns required matches", () => {
    const output: ValidationModelOutput = {
      candidateSummary: "Summary",
      requirementMatches: [
        {
          requirement: "Go experience",
          requirementType: "required",
          judgement: "supported",
          confidence: "high",
          evidence: [],
          gaps: [],
          suggestedScore: 4,
          reasoning: "ok",
        },
      ],
      overall: {
        strengths: [],
        gaps: [],
        concerns: [],
        suggestedInterviewQuestions: [],
        recruiterSummary: "r",
        confidence: "medium",
        confidenceRationale: "Only one required skill was assessed by the model.",
      },
    };

    const merged = ensureRequirementCoverage(output, {
      jobId: "job1",
      title: "Dev",
      descriptionMarkdown: "",
      requiredSkills: ["Go experience", "REST APIs"],
      niceToHaveSkills: ["GraphQL", "GCP exposure"],
    });

    assert.equal(merged.requirementMatches.filter((m) => m.requirementType === "nice_to_have").length, 2);
    assert.equal(merged.requirementMatches.filter((m) => m.requirementType === "required").length, 2);
  });
});
