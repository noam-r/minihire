import type { Confidence, CvJudgement, RecommendationLabel } from "./types";

export const RECOMMENDATION_LABELS: Record<RecommendationLabel, string> = {
  review_manually: "Review manually",
  promising_match: "Promising match",
  needs_clarification: "Needs clarification",
  weak_match: "Weak match",
};

export const JUDGEMENT_LABELS: Record<CvJudgement, string> = {
  supported: "Demonstrated in CV",
  claimed: "Stated in CV only",
  partial: "Partially demonstrated",
  missing: "Not found in CV",
  unclear: "Unclear from CV",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function formatRecommendationLabel(value: string | undefined | null): string {
  if (!value) {
    return "—";
  }
  return RECOMMENDATION_LABELS[value as RecommendationLabel] ?? titleCaseWords(value.replaceAll("_", " "));
}

export function formatJudgementLabel(value: string): string {
  return JUDGEMENT_LABELS[value as CvJudgement] ?? titleCaseWords(value.replaceAll("_", " "));
}

export function formatConfidenceLabel(value: string | undefined | null): string {
  if (!value) {
    return "—";
  }
  return CONFIDENCE_LABELS[value as Confidence] ?? titleCaseWords(value);
}

function titleCaseWords(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}
