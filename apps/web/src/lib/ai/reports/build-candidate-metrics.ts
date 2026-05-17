import type {
  CandidateEvaluationMetrics,
  CvFitMetrics,
  NormalizedApplication,
  NormalizedJob,
} from "../shared/types";
import {
  assessApplicationLogistics,
  hasLogisticsDealBreaker,
} from "../validation/assess-application-logistics";

export function buildCandidateMetrics(input: {
  cvMetrics: CvFitMetrics;
  normalized: NormalizedApplication;
  job?: NormalizedJob;
}): CandidateEvaluationMetrics {
  const flags: string[] = [];

  if (input.normalized.cv.extractionStatus === "failed") {
    flags.push("cv_extraction_failed");
  }
  if (input.normalized.cv.wordCount < 80) {
    flags.push("low_information_cv");
  }
  if (!input.normalized.candidate.githubUrl?.trim()) {
    flags.push("github_not_provided");
  }

  const logisticsFindings = input.job
    ? assessApplicationLogistics(input.job, input.normalized.candidate)
    : [];
  if (logisticsFindings.some((f) => f.code === "location_mismatch_onsite" || f.code === "timezone_mismatch_onsite")) {
    flags.push("location_mismatch_onsite_hybrid");
  }
  if (logisticsFindings.some((f) => f.code === "phone_region_mismatch")) {
    flags.push("phone_region_mismatch");
  }
  const logisticsDealBreaker = hasLogisticsDealBreaker(logisticsFindings);

  const requiredGap =
    input.cvMetrics.requiredSkillsTotal > 0 &&
    input.cvMetrics.requiredSkillsMatched / input.cvMetrics.requiredSkillsTotal < 0.4;
  if (requiredGap) {
    flags.push("strong_required_skill_gap");
  }
  if (input.cvMetrics.confidence === "low") {
    flags.push("low_confidence_evaluation");
  }

  const confidence = input.cvMetrics.confidence;
  let recommendation: CandidateEvaluationMetrics["recommendation"] = "review_manually";

  if (input.normalized.cv.extractionStatus === "failed" || confidence === "low") {
    recommendation = "review_manually";
  } else if (logisticsDealBreaker || requiredGap) {
    recommendation = "weak_match";
  } else if (input.cvMetrics.overallCvFitScore >= 3.5) {
    recommendation = "promising_match";
  } else if (input.cvMetrics.overallCvFitScore >= 2.5) {
    recommendation = "needs_clarification";
  } else {
    recommendation = "weak_match";
  }

  return {
    overallFitScore: input.cvMetrics.overallCvFitScore,
    cvFitScore: input.cvMetrics.overallCvFitScore,
    requiredSkillsScore: input.cvMetrics.requiredSkillsScore,
    niceToHaveSkillsScore: input.cvMetrics.niceToHaveSkillsScore,
    confidence: input.cvMetrics.confidence,
    flags,
    recommendation,
  };
}
