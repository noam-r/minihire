import {
  CLARIFICATION_ITEM_SOURCES,
  type ClarificationAnswerInput,
  type ClarificationItemRecord,
  type ClarificationItemSource,
  type ClarificationQuestionInput,
} from "./types";

export const MAX_CLARIFICATION_QUESTIONS = 10;
export const MAX_QUESTION_LENGTH = 1000;
export const MAX_ANSWER_LENGTH = 5000;

export class ClarificationValidationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "ClarificationValidationError";
  }
}

function trimText(value: string): string {
  return value.trim();
}

function isClarificationItemSource(value: string): value is ClarificationItemSource {
  return (CLARIFICATION_ITEM_SOURCES as readonly string[]).includes(value);
}

export function validateClarificationQuestions(
  questions: ClarificationQuestionInput[],
): ClarificationQuestionInput[] {
  if (!questions.length) {
    throw new ClarificationValidationError("Add at least one question.", "no_questions");
  }
  if (questions.length > MAX_CLARIFICATION_QUESTIONS) {
    throw new ClarificationValidationError(
      `You can send up to ${MAX_CLARIFICATION_QUESTIONS} questions.`,
      "too_many_questions",
    );
  }

  return questions.map((q, index) => {
    const text = trimText(q.text);
    if (!text) {
      throw new ClarificationValidationError("Question cannot be empty.", "empty_question");
    }
    if (text.length > MAX_QUESTION_LENGTH) {
      throw new ClarificationValidationError(
        `Question is too long. Maximum length is ${MAX_QUESTION_LENGTH} characters.`,
        "question_too_long",
      );
    }
    if (!isClarificationItemSource(q.source)) {
      throw new ClarificationValidationError(`Invalid source at question ${index + 1}.`, "invalid_source");
    }
    return { text, source: q.source };
  });
}

/**
 * Coerce `ai_suggested` → `recruiter_edited` when text differs from AI at the same index.
 */
export function normalizeQuestionSources(
  questions: ClarificationQuestionInput[],
  aiSuggestions: string[],
): ClarificationQuestionInput[] {
  return questions.map((q, index) => {
    if (q.source !== "ai_suggested") {
      return q;
    }
    const original = trimText(aiSuggestions[index] ?? "");
    if (original && trimText(q.text) !== original) {
      return { ...q, source: "recruiter_edited" };
    }
    return q;
  });
}

export function parseClarificationQuestionsFromFormData(body: FormData): ClarificationQuestionInput[] {
  const indices = new Set<number>();
  for (const key of body.keys()) {
    const match = /^questions\[(\d+)\]\[text\]$/.exec(key);
    if (match) {
      indices.add(Number(match[1]));
    }
  }

  const sorted = [...indices].sort((a, b) => a - b);
  return sorted.map((index) => ({
    text: String(body.get(`questions[${index}][text]`) ?? ""),
    source: String(body.get(`questions[${index}][source]`) ?? "recruiter_added") as ClarificationItemSource,
  }));
}

export function validateClarificationAnswers(
  items: ClarificationItemRecord[],
  answers: ClarificationAnswerInput[],
): Map<string, string> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const result = new Map<string, string>();

  if (answers.length !== items.length) {
    throw new ClarificationValidationError("Please answer every question.", "missing_answer");
  }

  for (const answer of answers) {
    if (seen.has(answer.itemId)) {
      throw new ClarificationValidationError("Duplicate answer for the same question.", "duplicate_item");
    }
    seen.add(answer.itemId);

    const item = byId.get(answer.itemId);
    if (!item) {
      throw new ClarificationValidationError("Invalid question reference.", "unknown_item");
    }

    const text = trimText(answer.answerText);
    if (!text) {
      throw new ClarificationValidationError("Answer cannot be empty.", "empty_answer");
    }
    if (text.length > MAX_ANSWER_LENGTH) {
      throw new ClarificationValidationError(
        `Answer is too long. Maximum length is ${MAX_ANSWER_LENGTH} characters.`,
        "answer_too_long",
      );
    }
    result.set(answer.itemId, text);
  }

  for (const item of items) {
    if (!seen.has(item.id)) {
      throw new ClarificationValidationError("Please answer every question.", "missing_answer");
    }
  }

  return result;
}
