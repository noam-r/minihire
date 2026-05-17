import { formatScoreFraction } from "../shared/score-scale";
import type {
  CandidateEvaluationMetrics,
  CvFitMetrics,
  NormalizedApplication,
  NormalizedJob,
  RecommendationLabel,
} from "../shared/types";
import { hasLogisticsDealBreaker, assessApplicationLogistics } from "../validation/assess-application-logistics";

const FLAG_LABELS: Record<string, string> = {
  cv_extraction_failed: "CV text could not be extracted reliably",
  low_information_cv: "CV has very little content to assess",
  github_not_provided: "No GitHub profile was provided",
  strong_required_skill_gap: "Few required skills are strongly supported in the CV",
  low_confidence_evaluation: "Model confidence in the assessment was low",
  location_mismatch_onsite_hybrid: "Candidate location does not match the job region for an on-site or hybrid role",
  phone_region_mismatch: "Phone country code does not match the job region",
};

export function formatFlags(flags: string[]): string[] {
  return flags.map((flag) => FLAG_LABELS[flag] ?? flag.replaceAll("_", " "));
}

export function explainScores(cvMetrics: CvFitMetrics): string[] {
  const lines = [
    `Overall CV fit combines required skills (${formatScoreFraction(cvMetrics.requiredSkillsScore)}), nice-to-have skills (${formatScoreFraction(cvMetrics.niceToHaveSkillsScore)}), and application completeness (${formatScoreFraction(cvMetrics.applicationCompletenessScore)}) using a 70% / 20% / 10% weighting.`,
    `Required skills: ${cvMetrics.requiredSkillsMatched} of ${cvMetrics.requiredSkillsTotal} items have demonstrated or partial CV support.`,
    `Nice-to-have: ${cvMetrics.niceToHaveSkillsMatched} of ${cvMetrics.niceToHaveSkillsTotal} items have demonstrated or partial CV support.`,
    `Evidence coverage across all assessed requirements: ${formatScoreFraction(cvMetrics.evidenceCoverageScore)}.`,
  ];
  return lines;
}

export function explainRecommendation(input: {
  recommendation: RecommendationLabel;
  cvMetrics: CvFitMetrics;
  normalized: NormalizedApplication;
  job?: NormalizedJob;
}): string {
  const { recommendation, cvMetrics, normalized, job } = input;

  const logisticsFindings = job ? assessApplicationLogistics(job, normalized.candidate) : [];
  const logisticsDealBreaker = hasLogisticsDealBreaker(logisticsFindings);

  if (normalized.cv.extractionStatus === "failed" || recommendation === "review_manually") {
    if (normalized.cv.extractionStatus === "failed") {
      return "The CV could not be read reliably, so scores and labels should be treated as provisional—review the original file manually.";
    }
    if (cvMetrics.confidence === "low") {
      return "Model confidence in this assessment was low (thin, ambiguous, or conflicting CV evidence), so manual review is recommended before relying on the scores.";
    }
    return "This application needs manual review before relying on the automated assessment.";
  }

  const requiredGap =
    cvMetrics.requiredSkillsTotal > 0 &&
    cvMetrics.requiredSkillsMatched / cvMetrics.requiredSkillsTotal < 0.4;

  if (recommendation === "weak_match") {
    if (logisticsDealBreaker) {
      const top = logisticsFindings.find((f) => f.severity === "deal_breaker");
      return top
        ? `${top.title}—${top.detail}`
        : "Location or contact details conflict with the job region for an on-site or hybrid role.";
    }
    if (requiredGap) {
      return `Fewer than 40% of required skills (${cvMetrics.requiredSkillsMatched} of ${cvMetrics.requiredSkillsTotal}) are demonstrated or partially supported in the CV, and overall fit is ${formatScoreFraction(cvMetrics.overallCvFitScore)}.`;
    }
    return `Overall fit is ${formatScoreFraction(cvMetrics.overallCvFitScore)}, below the 2.5 threshold for a stronger advisory label.`;
  }

  if (recommendation === "needs_clarification") {
    return `Overall fit is ${formatScoreFraction(cvMetrics.overallCvFitScore)} (between 2.5 and 3.5). Some requirements may be claimed rather than demonstrated—use interview questions to clarify.`;
  }

  if (recommendation === "promising_match") {
    return `Overall fit is ${formatScoreFraction(cvMetrics.overallCvFitScore)} (at or above 3.5) with reasonable support on required skills (${cvMetrics.requiredSkillsMatched} of ${cvMetrics.requiredSkillsTotal} demonstrated or partial).`;
  }

  return "Advisory label derived from CV fit scores, required-skill coverage, and assessment confidence.";
}

export function buildEvaluationRationaleInput(input: {
  cvMetrics: CvFitMetrics;
  candidateMetrics: CandidateEvaluationMetrics;
  normalized: NormalizedApplication;
  job?: NormalizedJob;
}): {
  scoreBullets: string[];
  recommendationExplanation: string;
  flagLabels: string[];
} {
  return {
    scoreBullets: explainScores(input.cvMetrics),
    recommendationExplanation: explainRecommendation({
      recommendation: input.candidateMetrics.recommendation,
      cvMetrics: input.cvMetrics,
      normalized: input.normalized,
      job: input.job,
    }),
    flagLabels: formatFlags(input.candidateMetrics.flags),
  };
}
