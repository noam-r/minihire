import type PocketBase from "pocketbase";
import { ClientResponseError } from "pocketbase";
import type { RecordModel } from "pocketbase";

import type {
  CandidateEvaluationMetrics,
  CvFitMetrics,
  NormalizedApplication,
  ValidationModelOutput,
} from "../shared/types";
import {
  CV_EXTRACTED_MARKDOWN_LEGACY_PB_MAX_CHARS,
  CV_EXTRACTED_MARKDOWN_STORAGE_MAX_CHARS,
  PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS,
  PB_ARTIFACT_TEXT_STORAGE_MAX_CHARS,
  truncateForLlm,
  truncateForStorage,
} from "../shared/truncate";
import { CV_SCORING_VERSION, NORMALIZATION_VERSION, RECRUITER_REPORT_VERSION, VALIDATION_PROMPT_VERSION, VALIDATION_RESPONSE_SCHEMA_VERSION } from "../shared/versions";

export async function storeNormalization(
  pb: PocketBase,
  input: {
    applicationId: string;
    jobId: string;
    normalized: NormalizedApplication;
    status: "complete" | "failed" | "skipped";
    errorMessage?: string;
  },
): Promise<RecordModel> {
  const cv = input.normalized.cv;
  const body = buildNormalizationBody(input, cv.extractedMarkdown || "", cv.extractionWarnings);

  try {
    return await pb.collection("application_normalizations").create(body);
  } catch (error) {
    if (!isCvMarkdownLengthError(error)) {
      throw error;
    }
    const legacy = truncateForLlm(cv.extractedMarkdown || "", CV_EXTRACTED_MARKDOWN_LEGACY_PB_MAX_CHARS);
    const legacyWarnings = legacy.truncated
      ? [...cv.extractionWarnings, `storage:capped_cv_markdown_${CV_EXTRACTED_MARKDOWN_LEGACY_PB_MAX_CHARS}`]
      : cv.extractionWarnings;
    return pb.collection("application_normalizations").create(
      buildNormalizationBody(input, legacy.text, legacyWarnings),
    );
  }
}

function buildNormalizationBody(
  input: {
    applicationId: string;
    jobId: string;
    normalized: NormalizedApplication;
    status: "complete" | "failed" | "skipped";
    errorMessage?: string;
  },
  cvMarkdown: string,
  extractionWarnings: string[],
): Record<string, unknown> {
  const cv = input.normalized.cv;
  const storedCv = truncateForLlm(cvMarkdown, CV_EXTRACTED_MARKDOWN_STORAGE_MAX_CHARS);
  const warnings = storedCv.truncated
    ? [...extractionWarnings, `storage:capped_cv_markdown_${CV_EXTRACTED_MARKDOWN_STORAGE_MAX_CHARS}`]
    : extractionWarnings;

  return {
    application: input.applicationId,
    job: input.jobId,
    status: input.status,
    candidate_profile: input.normalized.candidate,
    cv_original_format: cv.originalFormat,
    cv_original_file_name: cv.originalFileName,
    cv_extracted_markdown: storedCv.text,
    cv_extraction_status: cv.extractionStatus,
    cv_extraction_warnings: warnings,
    cv_word_count: cv.wordCount,
    normalization_version: NORMALIZATION_VERSION,
    error_message: input.errorMessage ?? "",
  };
}

function isPbMaxTextConstraintError(error: unknown, fieldName: string): boolean {
  if (!(error instanceof ClientResponseError) || error.status !== 400) {
    return false;
  }
  const field = error.response?.data?.[fieldName];
  return (
    field != null &&
    typeof field === "object" &&
    "code" in field &&
    field.code === "validation_max_text_constraint"
  );
}

function isCvMarkdownLengthError(error: unknown): boolean {
  return isPbMaxTextConstraintError(error, "cv_extracted_markdown");
}

async function createWithStoredTextFields(
  pb: PocketBase,
  collection: string,
  body: Record<string, unknown>,
  textFields: Record<string, string>,
): Promise<RecordModel> {
  const prepared = { ...body, ...mapStoredTextFields(textFields, PB_ARTIFACT_TEXT_STORAGE_MAX_CHARS) };
  try {
    return await pb.collection(collection).create(prepared);
  } catch (error) {
    if (!(error instanceof ClientResponseError) || error.status !== 400) {
      throw error;
    }
    const failedField = Object.keys(textFields).find((name) => isPbMaxTextConstraintError(error, name));
    if (!failedField) {
      throw error;
    }
    const legacy = {
      ...prepared,
      ...mapStoredTextFields(textFields, PB_ARTIFACT_TEXT_LEGACY_MAX_CHARS),
    };
    return pb.collection(collection).create(legacy);
  }
}

function mapStoredTextFields(
  textFields: Record<string, string>,
  maxChars: number,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(textFields)) {
    out[field] = truncateForStorage(value, maxChars).text;
  }
  return out;
}

export async function storeValidation(
  pb: PocketBase,
  input: {
    applicationId: string;
    jobId: string;
    normalizationId?: string;
    status: "complete" | "failed" | "skipped";
    model?: string;
    rawModelOutput?: unknown;
    parsedOutput?: ValidationModelOutput;
    metrics?: CvFitMetrics;
    summary?: string;
    recruiterReportMd?: string;
    errorMessage?: string;
  },
): Promise<RecordModel> {
  const parsed = input.parsedOutput;
  const body: Record<string, unknown> = {
    application: input.applicationId,
    job: input.jobId,
    status: input.status,
  };

  if (input.normalizationId) {
    body.normalization = input.normalizationId;
  }

  Object.assign(body, {
    prompt_version: VALIDATION_PROMPT_VERSION,
    response_schema_version: VALIDATION_RESPONSE_SCHEMA_VERSION,
    model: input.model ?? "",
    raw_model_output: input.rawModelOutput ?? null,
    parsed_output: parsed ?? null,
    required_skills_score: input.metrics?.requiredSkillsScore,
    nice_to_have_score: input.metrics?.niceToHaveSkillsScore,
    evidence_coverage_score: input.metrics?.evidenceCoverageScore,
    application_completeness_score: input.metrics?.applicationCompletenessScore,
    cv_fit_score: input.metrics?.overallCvFitScore,
    confidence: input.metrics?.confidence ?? parsed?.overall.confidence,
    strengths: parsed?.overall.strengths ?? [],
    gaps: parsed?.overall.gaps ?? [],
    concerns: parsed?.overall.concerns ?? [],
    suggested_questions: parsed?.overall.suggestedInterviewQuestions ?? [],
    scoring_version: CV_SCORING_VERSION,
    error_message: input.errorMessage ?? "",
  });

  const summary = input.summary ?? parsed?.candidateSummary ?? "";
  const recruiterReportMd = input.recruiterReportMd ?? "";

  return createWithStoredTextFields(pb, "application_ai_validations", body, {
    summary,
    recruiter_report_md: recruiterReportMd,
  });
}

export async function storeEvaluationReport(
  pb: PocketBase,
  input: {
    applicationId: string;
    validationId?: string;
    status: "complete" | "partial" | "failed";
    metrics: CandidateEvaluationMetrics;
    reportMd: string;
  },
): Promise<RecordModel> {
  const body: Record<string, unknown> = {
    application: input.applicationId,
    status: input.status,
    overall_fit_score: input.metrics.overallFitScore,
    cv_fit_score: input.metrics.cvFitScore,
    required_skills_score: input.metrics.requiredSkillsScore,
    nice_to_have_score: input.metrics.niceToHaveSkillsScore,
    confidence: input.metrics.confidence,
    flags: input.metrics.flags,
    recommendation: input.metrics.recommendation,
    report_version: RECRUITER_REPORT_VERSION,
  };

  if (input.validationId) {
    body.validation = input.validationId;
  }

  return createWithStoredTextFields(pb, "application_ai_evaluation_reports", body, {
    report_md: input.reportMd,
  });
}

/** AI artifact collections have no PocketBase autodate `created`; ignore empty/invalid values. */
export function resolveAiEvaluatedAt(...candidates: (string | null | undefined)[]): string {
  for (const candidate of candidates) {
    if (candidate == null || candidate === "") {
      continue;
    }
    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

export async function syncApplicationAiScores(
  pb: PocketBase,
  input: {
    applicationId: string;
    cvFitScore?: number | null;
    requiredSkillsScore?: number | null;
    niceToHaveScore?: number | null;
    evaluatedAt?: string | null;
  },
): Promise<void> {
  const evaluatedAt = resolveAiEvaluatedAt(input.evaluatedAt);
  await pb.collection("applications").update(input.applicationId, {
    cv_fit_score: input.cvFitScore ?? null,
    required_skills_score: input.requiredSkillsScore ?? null,
    nice_to_have_score: input.niceToHaveScore ?? null,
    ai_evaluated_at: evaluatedAt,
  });
}

export async function syncApplicationStatusChangedAt(
  pb: PocketBase,
  applicationId: string,
  changedAt?: string,
): Promise<void> {
  await pb.collection("applications").update(applicationId, {
    status_changed_at: changedAt ?? new Date().toISOString(),
  });
}

export async function updateAiRun(
  pb: PocketBase,
  runId: string,
  patch: {
    status: string;
    started_at?: string;
    completed_at?: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await pb.collection("application_ai_runs").update(runId, patch);
}
