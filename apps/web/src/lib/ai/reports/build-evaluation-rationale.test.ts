import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCandidateMetrics } from "./build-candidate-metrics";
import {
  explainRecommendation,
  explainScores,
  formatFlags,
} from "./build-evaluation-rationale";
import type { CvFitMetrics, NormalizedApplication } from "../shared/types";

const baseApplication: NormalizedApplication = {
  applicationId: "a1",
  jobId: "j1",
  candidate: {},
  cv: {
    originalFileName: "cv.pdf",
    originalFormat: "pdf",
    extractedMarkdown: "x".repeat(200),
    extractionStatus: "success",
    extractionWarnings: [],
    wordCount: 200,
  },
  normalizedAt: "",
  normalizationVersion: "v1",
};

const baseCvMetrics: CvFitMetrics = {
  requiredSkillsScore: 2.2,
  niceToHaveSkillsScore: 2,
  evidenceCoverageScore: 3,
  applicationCompletenessScore: 4,
  overallCvFitScore: 2.1,
  requiredSkillsMatched: 1,
  requiredSkillsTotal: 5,
  niceToHaveSkillsMatched: 1,
  niceToHaveSkillsTotal: 3,
  confidence: "medium",
};

describe("explainRecommendation", () => {
  it("explains weak_match when required skill coverage is low", () => {
    const text = explainRecommendation({
      recommendation: "weak_match",
      cvMetrics: baseCvMetrics,
      normalized: baseApplication,
    });
    assert.match(text, /40%/);
    assert.match(text, /1 of 5/);
  });

  it("explains review_manually when CV extraction failed", () => {
    const text = explainRecommendation({
      recommendation: "review_manually",
      cvMetrics: { ...baseCvMetrics, confidence: "low" },
      normalized: {
        ...baseApplication,
        cv: { ...baseApplication.cv, extractionStatus: "failed" },
      },
    });
    assert.match(text, /could not be read/i);
  });

  it("aligns with buildCandidateMetrics for the same inputs", () => {
    const metrics = buildCandidateMetrics({
      cvMetrics: { ...baseCvMetrics, overallCvFitScore: 2.1 },
      normalized: baseApplication,
    });
    const text = explainRecommendation({
      recommendation: metrics.recommendation,
      cvMetrics: baseCvMetrics,
      normalized: baseApplication,
    });
    assert.equal(metrics.recommendation, "weak_match");
    assert.match(text, /2\.1/);
  });
});

describe("explainScores", () => {
  it("mentions weighting and matched counts", () => {
    const bullets = explainScores(baseCvMetrics);
    assert.ok(bullets.some((line) => line.includes("70%")));
    assert.ok(bullets.some((line) => line.includes("1 of 5")));
  });
});

describe("formatFlags", () => {
  it("maps known flags to readable labels", () => {
    const labels = formatFlags(["strong_required_skill_gap", "github_not_provided"]);
    assert.match(labels[0]!, /required skills/i);
    assert.match(labels[1]!, /GitHub/i);
  });
});
