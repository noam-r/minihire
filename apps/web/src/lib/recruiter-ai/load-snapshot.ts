import type PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";

import type { RequirementMatch, ValidationModelOutput } from "../ai/shared/types";

export type AiRunRow = RecordModel & {
  application: string;
  run_type: string;
  status: string;
  started_by: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
};

export type AiNormalizationRow = RecordModel & {
  status: string;
  cv_extraction_status?: string;
  cv_extraction_warnings?: string[];
  error_message?: string;
};

export type AiValidationRow = RecordModel & {
  status: string;
  model?: string;
  parsed_output?: ValidationModelOutput;
  summary?: string;
  strengths?: string[];
  gaps?: string[];
  concerns?: string[];
  suggested_questions?: string[];
  cv_fit_score?: number;
  required_skills_score?: number;
  nice_to_have_score?: number;
  evidence_coverage_score?: number;
  application_completeness_score?: number;
  confidence?: string;
  error_message?: string;
  prompt_version?: string;
  response_schema_version?: string;
  scoring_version?: string;
};

export type AiReportRow = RecordModel & {
  validation?: string;
  status: string;
  overall_fit_score?: number;
  cv_fit_score?: number;
  required_skills_score?: number;
  nice_to_have_score?: number;
  confidence?: string;
  recommendation?: string;
  flags?: string[];
  report_md?: string;
  report_version?: string;
};

export type RecruiterAiUiState = "not_run" | "in_progress" | "complete" | "failed" | "skipped";

export type RecruiterAiSnapshot = {
  state: RecruiterAiUiState;
  /** Newest run by finished/started time (not lexicographic id). */
  latestRun: AiRunRow | null;
  /** Run that is still requested or running, if any. */
  activeRun: AiRunRow | null;
  /** A requested run exists while we already show a completed evaluation. */
  hasQueuedRun: boolean;
  latestReport: AiReportRow | null;
  latestValidation: AiValidationRow | null;
  latestNormalization: AiNormalizationRow | null;
  requirementMatches: RequirementMatch[];
  suggestedQuestions: string[];
};

type SortableRecord = { id: string; created?: string; started_at?: string; completed_at?: string };

/** AI collections were created without PocketBase autodate fields; use run timestamps when present. */
export function recordSortTime(row: SortableRecord): number {
  for (const value of [row.completed_at, row.started_at, row.created]) {
    const parsed = Date.parse(String(value ?? ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

export function compareNewestFirst(a: SortableRecord, b: SortableRecord): number {
  const ta = recordSortTime(a);
  const tb = recordSortTime(b);
  if (ta !== tb) {
    return tb - ta;
  }
  return b.id.localeCompare(a.id);
}

export function newest<T extends SortableRecord>(rows: T[]): T | null {
  if (!rows.length) {
    return null;
  }
  return [...rows].sort(compareNewestFirst)[0] ?? null;
}

function pickLinkedRecord<T extends { id: string }>(
  rows: T[],
  linkedId: unknown,
): T | null {
  if (typeof linkedId !== "string" || !linkedId) {
    return null;
  }
  return rows.find((row) => row.id === linkedId) ?? null;
}

function pickValidationForRun(
  validations: AiValidationRow[],
  run: AiRunRow | null,
): AiValidationRow | null {
  const linked = pickLinkedRecord(validations, run?.metadata?.validationId);
  return linked ?? newest(validations);
}

function pickReportForRun(
  reports: AiReportRow[],
  run: AiRunRow | null,
  validation: AiValidationRow | null,
): AiReportRow | null {
  const linkedValidationId = run?.metadata?.validationId;
  if (typeof linkedValidationId === "string") {
    const byValidation = reports.find((report) => report.validation === linkedValidationId);
    if (byValidation) {
      return byValidation;
    }
  }
  if (validation) {
    const byValidation = reports.find((report) => report.validation === validation.id);
    if (byValidation) {
      return byValidation;
    }
  }
  return newest(reports);
}

export function findActiveRun(runs: AiRunRow[]): AiRunRow | null {
  const active = runs.filter((run) => run.status === "requested" || run.status === "running");
  return newest(active);
}

export function hasCompleteAiArtifacts(
  latestValidation: AiValidationRow | null,
  latestReport: AiReportRow | null,
): boolean {
  return (
    latestValidation?.status === "complete" ||
    latestReport?.status === "complete" ||
    latestReport?.status === "partial"
  );
}

export function resolveRecruiterAiState(input: {
  runs: AiRunRow[];
  latestValidation: AiValidationRow | null;
  latestReport: AiReportRow | null;
}): { state: RecruiterAiUiState; latestRun: AiRunRow | null; activeRun: AiRunRow | null; hasQueuedRun: boolean } {
  const { runs, latestValidation, latestReport } = input;
  const activeRun = findActiveRun(runs);
  const latestRun = newest(runs);
  const latestFinishedRun = newest(
    runs.filter((run) => run.status === "complete" || run.status === "failed" || run.status === "skipped"),
  );
  const hasArtifacts = hasCompleteAiArtifacts(latestValidation, latestReport);

  let state: RecruiterAiUiState = "not_run";

  if (activeRun?.status === "running") {
    state = "in_progress";
  } else if (latestFinishedRun?.status === "complete" && hasArtifacts) {
    state = latestValidation?.status === "skipped" ? "skipped" : "complete";
  } else if (activeRun?.status === "requested") {
    state = "in_progress";
  } else if (latestFinishedRun?.status === "failed") {
    state = "failed";
  } else if (latestFinishedRun?.status === "skipped" || latestValidation?.status === "skipped") {
    state = "skipped";
  } else if (hasArtifacts) {
    state = "complete";
  } else if (latestRun) {
    state = "in_progress";
  }

  const hasQueuedRun = activeRun?.status === "requested" && state === "complete";

  return {
    state,
    latestRun: latestFinishedRun ?? latestRun,
    activeRun,
    hasQueuedRun,
  };
}

export async function loadRecruiterAiSnapshot(
  pb: PocketBase,
  applicationId: string,
): Promise<RecruiterAiSnapshot> {
  const filter = pb.filter("application = {:aid}", { aid: applicationId });

  const [runsRaw, reportsRaw, validationsRaw, normalizationsRaw] = await Promise.all([
    pb.collection("application_ai_runs").getFullList<AiRunRow>({
      filter,
      sort: "-id",
      requestKey: `recruiter_ai_runs_${applicationId}`,
    }),
    pb.collection("application_ai_evaluation_reports").getFullList<AiReportRow>({
      filter,
      sort: "-id",
      requestKey: `recruiter_ai_reports_${applicationId}`,
    }),
    pb.collection("application_ai_validations").getFullList<AiValidationRow>({
      filter,
      sort: "-id",
      requestKey: `recruiter_ai_validations_${applicationId}`,
    }),
    pb.collection("application_normalizations").getFullList<AiNormalizationRow>({
      filter,
      sort: "-id",
      requestKey: `recruiter_ai_norm_${applicationId}`,
    }),
  ]);

  const latestNormalization = newest(normalizationsRaw);

  const { state, latestRun, activeRun, hasQueuedRun } = resolveRecruiterAiState({
    runs: runsRaw,
    latestValidation: newest(validationsRaw),
    latestReport: newest(reportsRaw),
  });

  const latestValidation = pickValidationForRun(validationsRaw, latestRun);
  const latestReport = pickReportForRun(reportsRaw, latestRun, latestValidation);

  const parsed = latestValidation?.parsed_output;
  const requirementMatches = Array.isArray(parsed?.requirementMatches) ? parsed.requirementMatches : [];
  const suggestedQuestions =
    latestValidation?.suggested_questions ??
    parsed?.overall?.suggestedInterviewQuestions ??
    [];

  return {
    state,
    latestRun,
    activeRun,
    hasQueuedRun,
    latestReport,
    latestValidation,
    latestNormalization,
    requirementMatches,
    suggestedQuestions,
  };
}

export function hasActiveAiRun(snapshot: RecruiterAiSnapshot): boolean {
  const status = snapshot.activeRun?.status;
  return status === "requested" || status === "running";
}
