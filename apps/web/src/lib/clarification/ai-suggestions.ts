import type PocketBase from "pocketbase";

import { compareNewestFirst, newest } from "../recruiter-ai/load-snapshot";
import type { AiRunRow, AiValidationRow } from "../recruiter-ai/load-snapshot";
import type { ClarificationQuestionInput } from "./types";

function escapeFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function extractSuggestedStrings(validation: AiValidationRow | null): string[] {
  if (!validation) {
    return [];
  }
  const fromField = validation.suggested_questions;
  if (Array.isArray(fromField) && fromField.length) {
    return fromField.map((q) => String(q).trim()).filter(Boolean);
  }
  const parsed = validation.parsed_output?.overall?.suggestedInterviewQuestions;
  if (Array.isArray(parsed)) {
    return parsed.map((q) => String(q).trim()).filter(Boolean);
  }
  return [];
}

/**
 * Latest completed validation for the application (same run selection as recruiter AI snapshot).
 */
export async function getSuggestedClarificationQuestions(
  pb: PocketBase,
  applicationId: string,
): Promise<ClarificationQuestionInput[]> {
  const aid = escapeFilterValue(applicationId);

  let runs: AiRunRow[];
  try {
    runs = await pb.collection("application_ai_runs").getFullList<AiRunRow>({
      filter: `application = "${aid}" && status = "complete"`,
      sort: "-completed_at,-started_at,-created",
    });
  } catch {
    return [];
  }

  if (!runs.length) {
    return [];
  }

  runs.sort(compareNewestFirst);
  const latestRun = runs[0]!;

  let validations: AiValidationRow[];
  try {
    validations = await pb.collection("application_ai_validations").getFullList<AiValidationRow>({
      filter: `application = "${aid}" && status = "complete"`,
    });
  } catch {
    return [];
  }

  const linkedId = latestRun.metadata?.validationId;
  const validation =
    typeof linkedId === "string"
      ? (validations.find((v) => v.id === linkedId) ?? newest(validations))
      : newest(validations);
  const texts = extractSuggestedStrings(validation);

  return texts.map((text) => ({ text, source: "ai_suggested" as const }));
}
