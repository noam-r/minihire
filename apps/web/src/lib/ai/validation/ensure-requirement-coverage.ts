import type { NormalizedJob, RequirementMatch, ValidationModelOutput } from "../shared/types";

function normalizeRequirementKey(text: string): string {
  return text
    .replace(/^-\s*/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function requirementMatchesSkill(skill: string, match: RequirementMatch): boolean {
  const skillKey = normalizeRequirementKey(skill);
  const matchKey = normalizeRequirementKey(match.requirement);
  if (!skillKey || !matchKey) {
    return false;
  }
  if (skillKey === matchKey) {
    return true;
  }
  const prefix = skillKey.slice(0, Math.min(48, skillKey.length));
  return matchKey.includes(prefix) || skillKey.includes(matchKey.slice(0, Math.min(48, matchKey.length)));
}

function isCovered(skill: string, matches: RequirementMatch[]): boolean {
  return matches.some((match) => requirementMatchesSkill(skill, match));
}

function createMissingMatch(
  requirement: string,
  requirementType: "required" | "nice_to_have",
): RequirementMatch {
  return {
    requirement,
    requirementType,
    judgement: "missing",
    confidence: "low",
    evidence: [],
    gaps: ["This item was not returned by the model and was added by the evaluation pipeline."],
    suggestedScore: 0,
    reasoning:
      "No structured assessment was returned for this job requirement. Treat as not evaluated until reviewed manually or re-run.",
  };
}

/**
 * The LLM often evaluates only a subset of job requirements. The design spec requires one
 * row per `requiredSkills` / `niceToHaveSkills` line from the job record.
 */
export function ensureRequirementCoverage(
  output: ValidationModelOutput,
  job: NormalizedJob,
): ValidationModelOutput {
  const matches = [...output.requirementMatches];

  for (const skill of job.requiredSkills) {
    if (!isCovered(skill, matches)) {
      matches.push(createMissingMatch(skill, "required"));
    }
  }

  for (const skill of job.niceToHaveSkills) {
    if (!isCovered(skill, matches)) {
      matches.push(createMissingMatch(skill, "nice_to_have"));
    }
  }

  return {
    ...output,
    requirementMatches: matches,
  };
}
