import { formatScoreFraction, AI_SCORE_MAX } from "../ai/shared/score-scale";
import {
  formatConfidenceLabel,
  formatJudgementLabel,
  formatRecommendationLabel,
} from "../ai/shared/labels";
import type { RequirementMatch } from "../ai/shared/types";

export { AI_SCORE_MAX, formatScoreFraction };

export const AI_EVIDENCE_DISCLAIMER =
  "Assessments in this table are based on the CV and application form only. GitHub verification is not part of this evaluation.";

export const AI_DISCLAIMER =
  "AI evaluation is an internal review aid. A human recruiter is responsible for hiring decisions.";

/** Legacy disclaimer baked into stored report_md; shown once in UI/export chrome instead. */
const EMBEDDED_REPORT_DISCLAIMER =
  /^#\s+AI-Assisted Candidate Evaluation\s*\n+(?:>\s*[^\n]+\n+)*/im;

/** Remove blockquote disclaimer(s) under the report title (old reports stored one in report_md). */
export function stripEmbeddedReportDisclaimer(markdown: string): string {
  return markdown.replace(EMBEDDED_REPORT_DISCLAIMER, "# AI-Assisted Candidate Evaluation\n\n").trim();
}

/** @deprecated Use formatScoreFraction for display with scale. */
export function formatScore(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return value.toFixed(1);
}

export function formatRecommendation(value: string | undefined | null): string {
  return formatRecommendationLabel(value);
}

export function formatJudgement(value: string): string {
  return formatJudgementLabel(value);
}

export function formatConfidence(value: string | undefined | null): string {
  return formatConfidenceLabel(value);
}

export function formatRequirementType(value: string): string {
  return value === "nice_to_have" ? "Nice-to-have" : "Required";
}

export function requirementTypeEvaluated(
  matches: RequirementMatch[],
  type: "required" | "nice_to_have",
): boolean {
  return matches.some((match) => match.requirementType === type);
}

export function evidencePreview(match: RequirementMatch): string {
  if (!match.evidence.length) {
    return "—";
  }
  const first = match.evidence[0];
  const text = first.quoteOrSummary.trim();
  if (text.length <= 120) {
    return text;
  }
  return `${text.slice(0, 117)}…`;
}

export function friendlyAiFailure(input: {
  runError?: string;
  validationError?: string;
  normalizationError?: string;
  extractionStatus?: string;
}): string {
  if (input.runError?.trim()) {
    return input.runError.trim();
  }
  if (input.validationError?.trim()) {
    return input.validationError.trim();
  }
  if (input.normalizationError?.trim()) {
    return input.normalizationError.trim();
  }
  if (input.extractionStatus === "failed") {
    return "PDF to Markdown process failed, cannot read PDF file.";
  }
  return "AI evaluation could not be completed. You can still review the application manually.";
}
