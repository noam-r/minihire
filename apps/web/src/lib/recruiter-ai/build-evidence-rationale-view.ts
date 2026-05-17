import {
  buildEvaluationRationaleInput,
  formatFlags,
} from "../ai/reports/build-evaluation-rationale";
import { assessApplicationLogistics } from "../ai/validation/assess-application-logistics";
import type { LogisticsFinding } from "../ai/validation/assess-application-logistics";
import type {
  CandidateEvaluationMetrics,
  CvFitMetrics,
  NormalizedApplication,
  NormalizedJob,
} from "../ai/shared/types";
import { buildEvidenceDigest, truncateVerdict } from "./build-evidence-digest";
import type { RecruiterAiSnapshot } from "./load-snapshot";
import type { AiNormalizationRow, AiReportRow, AiValidationRow } from "./load-snapshot";

export type EvidenceRationaleView = {
  candidateSummary: string;
  recruiterSummary: string;
  confidence: string | undefined;
  confidenceRationale: string | null;
  recommendation: string | undefined;
  recommendationExplanation: string | null;
  verdictOneLiner: string;
  scoreBullets: string[];
  strengths: string[];
  gaps: string[];
  concerns: string[];
  secondaryConcerns: string[];
  flagLabels: string[];
  criticalFindings: LogisticsFinding[];
};

export type EvidenceJobContext = Pick<
  NormalizedJob,
  "jobId" | "title" | "descriptionMarkdown" | "workModel" | "workLocation"
> & {
  requiredSkills?: string[];
  niceToHaveSkills?: string[];
};

export type EvidenceApplicationContact = {
  location?: string;
  timezone?: string;
  phoneNumber?: string;
};

export function jobContextFromRecord(job: {
  id: string;
  title?: string;
  description?: string;
  workModel?: string;
  workLocation?: string;
}): EvidenceJobContext {
  return {
    jobId: job.id,
    title: job.title ?? "",
    descriptionMarkdown: job.description ?? "",
    workModel: job.workModel,
    workLocation: job.workLocation,
  };
}

export function contactFromApplication(record: {
  location?: string;
  timezone?: string;
  phone_number?: string;
}): EvidenceApplicationContact {
  return {
    location: record.location,
    timezone: record.timezone,
    phoneNumber: record.phone_number,
  };
}

function countMatched(
  matches: RecruiterAiSnapshot["requirementMatches"],
  type: "required" | "nice_to_have",
): { matched: number; total: number } {
  const filtered = matches.filter((match) => match.requirementType === type);
  const matched = filtered.filter(
    (match) => match.judgement === "supported" || match.judgement === "partial",
  ).length;
  return { matched, total: filtered.length };
}

function buildCvMetrics(input: {
  validation: AiValidationRow | null;
  report: AiReportRow | null;
  matches: RecruiterAiSnapshot["requirementMatches"];
}): CvFitMetrics {
  const required = countMatched(input.matches, "required");
  const nice = countMatched(input.matches, "nice_to_have");

  return {
    requiredSkillsScore: input.report?.required_skills_score ?? input.validation?.required_skills_score ?? 0,
    niceToHaveSkillsScore: input.report?.nice_to_have_score ?? input.validation?.nice_to_have_score ?? 0,
    evidenceCoverageScore: input.validation?.evidence_coverage_score ?? 0,
    applicationCompletenessScore: input.validation?.application_completeness_score ?? 0,
    overallCvFitScore:
      input.report?.cv_fit_score ??
      input.report?.overall_fit_score ??
      input.validation?.cv_fit_score ??
      0,
    requiredSkillsMatched: required.matched,
    requiredSkillsTotal: required.total,
    niceToHaveSkillsMatched: nice.matched,
    niceToHaveSkillsTotal: nice.total,
    confidence: (input.report?.confidence ?? input.validation?.confidence ?? "medium") as CvFitMetrics["confidence"],
  };
}

function buildNormalizedApplication(input: {
  applicationId: string;
  jobId: string;
  normalization: AiNormalizationRow | null;
  contact?: EvidenceApplicationContact;
}): NormalizedApplication {
  const profile = input.normalization?.candidate_profile;
  const fromProfile =
    profile && typeof profile === "object" && !Array.isArray(profile)
      ? (profile as NormalizedApplication["candidate"])
      : {};

  const candidate = {
    ...fromProfile,
    location: input.contact?.location?.trim() || fromProfile.location,
    timezone: input.contact?.timezone?.trim() || fromProfile.timezone,
    phoneNumber: input.contact?.phoneNumber?.trim() || fromProfile.phoneNumber,
  };

  return {
    applicationId: input.applicationId,
    jobId: input.jobId,
    candidate,
    cv: {
      originalFileName: input.normalization?.cv_original_file_name ?? "",
      originalFormat: input.normalization?.cv_original_format === "markdown" ? "markdown" : "pdf",
      extractedMarkdown: "",
      extractionStatus: input.normalization?.cv_extraction_status === "failed" ? "failed" : "success",
      extractionWarnings: Array.isArray(input.normalization?.cv_extraction_warnings)
        ? input.normalization.cv_extraction_warnings
        : [],
      wordCount: input.normalization?.cv_word_count ?? 0,
    },
    normalizedAt: "",
    normalizationVersion: input.normalization?.normalization_version ?? "",
  };
}

function toNormalizedJob(job: EvidenceJobContext): NormalizedJob {
  return {
    jobId: job.jobId,
    title: job.title ?? "",
    descriptionMarkdown: job.descriptionMarkdown ?? "",
    requiredSkills: job.requiredSkills ?? [],
    niceToHaveSkills: job.niceToHaveSkills ?? [],
    workModel: job.workModel,
    workLocation: job.workLocation,
  };
}

export function buildEvidenceRationaleView(input: {
  snapshot: RecruiterAiSnapshot;
  report: AiReportRow | null;
  validation: AiValidationRow | null;
  normalization: AiNormalizationRow | null;
  applicationId: string;
  jobId: string;
  job?: EvidenceJobContext;
  contact?: EvidenceApplicationContact;
}): EvidenceRationaleView {
  const parsed = input.validation?.parsed_output;
  const cvMetrics = buildCvMetrics({
    validation: input.validation,
    report: input.report,
    matches: input.snapshot.requirementMatches,
  });

  const normalized = buildNormalizedApplication({
    applicationId: input.applicationId,
    jobId: input.jobId,
    normalization: input.normalization,
    contact: input.contact,
  });

  const job = input.job ? toNormalizedJob(input.job) : undefined;

  const candidateMetrics: CandidateEvaluationMetrics = {
    overallFitScore: cvMetrics.overallCvFitScore,
    cvFitScore: cvMetrics.overallCvFitScore,
    requiredSkillsScore: cvMetrics.requiredSkillsScore,
    niceToHaveSkillsScore: cvMetrics.niceToHaveSkillsScore,
    confidence: cvMetrics.confidence,
    flags: Array.isArray(input.report?.flags) ? input.report.flags : [],
    recommendation: (input.report?.recommendation ?? "review_manually") as CandidateEvaluationMetrics["recommendation"],
  };

  const serverRationale = buildEvaluationRationaleInput({
    cvMetrics,
    candidateMetrics,
    normalized,
    job,
  });

  const allStrengths = parsed?.overall.strengths ?? input.validation?.strengths ?? [];
  const allGaps = parsed?.overall.gaps ?? input.validation?.gaps ?? [];
  const allConcerns = parsed?.overall.concerns ?? input.validation?.concerns ?? [];

  const logisticsFindings = job ? assessApplicationLogistics(job, normalized.candidate) : [];

  const digest = buildEvidenceDigest({
    logisticsFindings,
    modelConcerns: allConcerns,
    strengths: allStrengths,
    gaps: allGaps,
    concerns: allConcerns,
  });

  const recommendationExplanation = input.report?.recommendation
    ? serverRationale.recommendationExplanation
    : null;

  const hiddenWhenCritical = new Set([
    "location_mismatch_onsite_hybrid",
    "phone_region_mismatch",
  ]);
  const visibleFlags =
    digest.criticalFindings.length > 0
      ? candidateMetrics.flags.filter((flag) => !hiddenWhenCritical.has(flag))
      : candidateMetrics.flags;
  const flagLabels = formatFlags(visibleFlags);

  return {
    candidateSummary:
      parsed?.candidateSummary?.trim() || input.validation?.summary?.trim() || "",
    recruiterSummary: parsed?.overall.recruiterSummary?.trim() || "",
    confidence: input.report?.confidence ?? input.validation?.confidence,
    confidenceRationale: parsed?.overall.confidenceRationale?.trim() || null,
    recommendation: input.report?.recommendation,
    recommendationExplanation,
    verdictOneLiner: truncateVerdict(recommendationExplanation ?? ""),
    scoreBullets: serverRationale.scoreBullets,
    strengths: digest.strengths,
    gaps: digest.gaps,
    concerns: digest.concerns,
    secondaryConcerns: digest.secondaryConcerns,
    flagLabels,
    criticalFindings: digest.criticalFindings,
  };
}
