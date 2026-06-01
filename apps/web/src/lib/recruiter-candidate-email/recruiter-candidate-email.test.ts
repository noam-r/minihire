import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCandidateEmailPlainText } from "./build-message";
import { defaultCandidateEmailBody, defaultCandidateEmailSubject } from "./templates";
import {
  emailLogTemplateForType,
  formatRecruiterCandidateEmailLogLabel,
  isRecruiterCandidateEmailType,
} from "./types";
import {
  CandidateEmailValidationError,
  MAX_CANDIDATE_EMAIL_BODY_LEN,
  validateCandidateEmailBody,
} from "./validation";

describe("isRecruiterCandidateEmailType", () => {
  it("accepts known types", () => {
    assert.equal(isRecruiterCandidateEmailType("rejection"), true);
    assert.equal(isRecruiterCandidateEmailType("free_text_clarification"), true);
  });

  it("rejects unknown types", () => {
    assert.equal(isRecruiterCandidateEmailType("interview"), false);
  });
});

describe("emailLogTemplateForType", () => {
  it("maps UI types to email_logs templates", () => {
    assert.equal(emailLogTemplateForType("rejection"), "application_rejected");
    assert.equal(emailLogTemplateForType("free_text_clarification"), "free_text_clarification");
  });
});

describe("defaultCandidateEmailSubject", () => {
  it("includes job title", () => {
    assert.match(
      defaultCandidateEmailSubject("rejection", {
        candidateName: "Alex",
        jobTitle: "Engineer",
      }),
      /Engineer/,
    );
  });
});

describe("defaultCandidateEmailBody", () => {
  it("returns non-empty starter copy for each type", () => {
    const input = { candidateName: "Alex", jobTitle: "Engineer" };
    assert.ok(defaultCandidateEmailBody("rejection", input).length > 20);
    assert.ok(defaultCandidateEmailBody("free_text_clarification", input).length > 20);
  });
});

describe("buildCandidateEmailPlainText", () => {
  it("wraps body with greeting and sign-off", () => {
    const text = buildCandidateEmailPlainText({
      candidateName: "Alex",
      body: "Main message.",
    });
    assert.match(text, /^Hi Alex,/);
    assert.match(text, /Main message\./);
    assert.ok(text.trim().length > "Main message.".length);
  });
});

describe("validateCandidateEmailBody", () => {
  it("trims and accepts non-empty body", () => {
    assert.equal(validateCandidateEmailBody("  Hello  "), "Hello");
  });

  it("rejects empty body", () => {
    assert.throws(() => validateCandidateEmailBody("   "), CandidateEmailValidationError);
  });

  it("rejects overly long body", () => {
    assert.throws(
      () => validateCandidateEmailBody("x".repeat(MAX_CANDIDATE_EMAIL_BODY_LEN + 1)),
      CandidateEmailValidationError,
    );
  });
});

describe("formatRecruiterCandidateEmailLogLabel", () => {
  it("formats known templates", () => {
    assert.equal(formatRecruiterCandidateEmailLogLabel("application_rejected"), "Rejection");
    assert.equal(
      formatRecruiterCandidateEmailLogLabel("free_text_clarification"),
      "Free-text clarification",
    );
  });
});
