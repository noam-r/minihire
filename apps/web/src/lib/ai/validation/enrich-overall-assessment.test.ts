import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ValidationModelOutput } from "../shared/types";
import { enrichOverallAssessment } from "./enrich-overall-assessment";

describe("enrichOverallAssessment", () => {
  it("adds a seniority concern when the candidate cites many years for a junior role", () => {
    const output: ValidationModelOutput = {
      candidateSummary: "Over 10 years of experience in web development.",
      requirementMatches: [],
      overall: {
        strengths: [],
        gaps: [],
        concerns: [],
        suggestedInterviewQuestions: [],
        recruiterSummary: "r",
        confidence: "medium",
        confidenceRationale: "Limited requirement coverage in this test fixture.",
      },
    };

    const enriched = enrichOverallAssessment(
      output,
      {
        jobId: "j1",
        title: "Junior Full-Stack Developer",
        descriptionMarkdown: "",
        requiredSkills: ["1–2 years of experience with a modern web stack"],
        niceToHaveSkills: [],
      },
      {
        applicationId: "a1",
        jobId: "j1",
        candidate: { anythingElse: "10 years in the industry" },
        cv: {
          originalFileName: "cv.pdf",
          originalFormat: "pdf",
          extractedMarkdown: "",
          extractionStatus: "success",
          extractionWarnings: [],
          wordCount: 100,
        },
        normalizedAt: "",
        normalizationVersion: "v1",
      },
    );

    assert.ok(enriched.overall.concerns.some((c) => c.toLowerCase().includes("junior")));
  });

  it("prepends logistics concerns for onsite location mismatch", () => {
    const output: ValidationModelOutput = {
      candidateSummary: "Backend developer.",
      requirementMatches: [],
      overall: {
        strengths: [],
        gaps: [],
        concerns: [],
        suggestedInterviewQuestions: [],
        recruiterSummary: "r",
        confidence: "medium",
        confidenceRationale: "Test fixture.",
      },
    };

    const enriched = enrichOverallAssessment(
      output,
      {
        jobId: "j1",
        title: "Engineer",
        descriptionMarkdown: "Tel Aviv office.",
        requiredSkills: [],
        niceToHaveSkills: [],
        workModel: "onsite",
        workLocation: "Israel",
      },
      {
        applicationId: "a1",
        jobId: "j1",
        candidate: {
          location: "Bangalore, India",
          timezone: "Asia/Kolkata",
          phoneNumber: "+91 98765 43210",
        },
        cv: {
          originalFileName: "cv.pdf",
          originalFormat: "pdf",
          extractedMarkdown: "",
          extractionStatus: "success",
          extractionWarnings: [],
          wordCount: 100,
        },
        normalizedAt: "",
        normalizationVersion: "v1",
      },
    );

    assert.ok(enriched.overall.concerns[0]?.toLowerCase().includes("location mismatch"));
  });
});
