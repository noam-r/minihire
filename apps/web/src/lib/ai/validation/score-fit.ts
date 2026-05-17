import type {
  CvFitMetrics,
  CvJudgement,
  NormalizedApplication,
  NormalizedJob,
  ValidationModelOutput,
} from "../shared/types";

const JUDGEMENT_WEIGHTS: Record<CvJudgement, number> = {
  supported: 1.0,
  claimed: 0.65,
  partial: 0.4,
  unclear: 0.2,
  missing: 0.0,
};

function averageWeightedScore(
  matches: ValidationModelOutput["requirementMatches"],
  type: "required" | "nice_to_have",
): { score: number; matched: number; total: number } {
  const filtered = matches.filter((m) => m.requirementType === type);
  if (filtered.length === 0) {
    return { score: 0, matched: 0, total: 0 };
  }

  let sum = 0;
  let matched = 0;
  for (const match of filtered) {
    const weight = JUDGEMENT_WEIGHTS[match.judgement];
    const normalized = (match.suggestedScore / 5) * weight;
    sum += normalized;
    if (match.judgement === "supported" || match.judgement === "partial") {
      matched += 1;
    }
  }

  const score = (sum / filtered.length) * 5;
  return { score: roundScore(score), matched, total: filtered.length };
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeApplicationCompleteness(
  applicationFields: Record<string, string | undefined>,
): number {
  const keys = [
    "fullName",
    "location",
    "timezone",
    "githubUrl",
    "portfolioUrl",
    "linkedinUrl",
    "anythingElse",
  ] as const;
  const filled = keys.filter((key) => Boolean(applicationFields[key]?.trim())).length;
  return roundScore((filled / keys.length) * 5);
}

function computeEvidenceCoverage(matches: ValidationModelOutput["requirementMatches"]): number {
  if (matches.length === 0) {
    return 0;
  }
  const withEvidence = matches.filter((m) => m.evidence.length > 0).length;
  return roundScore((withEvidence / matches.length) * 5);
}

export function scoreFit(input: {
  parsedOutput: ValidationModelOutput;
  job: NormalizedJob;
  candidate?: NormalizedApplication["candidate"];
}): CvFitMetrics {
  const required = averageWeightedScore(input.parsedOutput.requirementMatches, "required");
  const nice = averageWeightedScore(input.parsedOutput.requirementMatches, "nice_to_have");

  const applicationCompletenessScore = computeApplicationCompleteness({
    fullName: input.candidate?.fullName,
    location: input.candidate?.location,
    timezone: input.candidate?.timezone,
    githubUrl: input.candidate?.githubUrl,
    portfolioUrl: input.candidate?.portfolioUrl,
    linkedinUrl: input.candidate?.linkedinUrl,
    anythingElse: input.candidate?.anythingElse,
  });

  const evidenceCoverageScore = computeEvidenceCoverage(input.parsedOutput.requirementMatches);

  const requiredSkillsScore =
    required.total > 0 ? required.score : roundScore(input.job.requiredSkills.length === 0 ? 3 : 0);
  const niceToHaveSkillsScore =
    nice.total > 0 ? nice.score : roundScore(input.job.niceToHaveSkills.length === 0 ? 3 : 0);

  const overallCvFitScore = roundScore(
    requiredSkillsScore * 0.7 + niceToHaveSkillsScore * 0.2 + applicationCompletenessScore * 0.1,
  );

  return {
    requiredSkillsScore,
    niceToHaveSkillsScore,
    evidenceCoverageScore,
    applicationCompletenessScore,
    overallCvFitScore,
    requiredSkillsMatched: required.matched,
    requiredSkillsTotal: required.total || input.job.requiredSkills.length,
    niceToHaveSkillsMatched: nice.matched,
    niceToHaveSkillsTotal: nice.total || input.job.niceToHaveSkills.length,
    confidence: input.parsedOutput.overall.confidence,
  };
}
