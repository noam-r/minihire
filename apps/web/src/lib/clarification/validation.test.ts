import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ClarificationValidationError,
  normalizeQuestionSources,
  validateClarificationAnswers,
  validateClarificationQuestions,
} from "./validation";
import type { ClarificationItemRecord } from "./types";

describe("validateClarificationQuestions", () => {
  it("rejects empty list", () => {
    assert.throws(
      () => validateClarificationQuestions([]),
      (e: unknown) => e instanceof ClarificationValidationError && e.code === "no_questions",
    );
  });

  it("rejects empty question text", () => {
    assert.throws(
      () => validateClarificationQuestions([{ text: "  ", source: "recruiter_added" }]),
      (e: unknown) => e instanceof ClarificationValidationError && e.code === "empty_question",
    );
  });

  it("coerces ai_suggested to recruiter_edited when text changed", () => {
    const result = normalizeQuestionSources(
      [{ text: "Changed", source: "ai_suggested" }],
      ["Original"],
    );
    assert.equal(result[0]?.source, "recruiter_edited");
  });
});

describe("validateClarificationAnswers", () => {
  const items = [
    { id: "a", question_text: "Q1" },
    { id: "b", question_text: "Q2" },
  ] as ClarificationItemRecord[];

  it("rejects unknown item id", () => {
    assert.throws(
      () =>
        validateClarificationAnswers(items, [
          { itemId: "a", answerText: "yes" },
          { itemId: "z", answerText: "no" },
        ]),
      (e: unknown) => e instanceof ClarificationValidationError && e.code === "unknown_item",
    );
  });

  it("accepts complete answers", () => {
    const map = validateClarificationAnswers(items, [
      { itemId: "a", answerText: "one" },
      { itemId: "b", answerText: "two" },
    ]);
    assert.equal(map.get("a"), "one");
    assert.equal(map.get("b"), "two");
  });
});
