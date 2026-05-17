import type { NormalizedApplication, NormalizedJob, ValidationModelOutput } from "../shared/types";
import {
  assessApplicationLogistics,
  logisticsFindingToConcern,
} from "./assess-application-logistics";

function collectExperienceText(
  output: ValidationModelOutput,
  application: NormalizedApplication,
): string {
  return [
    output.candidateSummary,
    application.candidate.anythingElse ?? "",
    application.cv.extractedMarkdown.slice(0, 4000),
  ]
    .join("\n")
    .toLowerCase();
}

function jobTargetsJuniorExperience(job: NormalizedJob): boolean {
  const blob = [job.title, job.descriptionMarkdown, ...job.requiredSkills].join("\n").toLowerCase();
  return /\bjunior\b/.test(blob) || /1\s*[–-]\s*2\s*years/.test(blob);
}

function maxYearsMentioned(text: string): number | null {
  const matches = [...text.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)(?:\s+of)?/gi)];
  if (!matches.length) {
    return null;
  }
  return Math.max(...matches.map((match) => Number.parseInt(match[1] ?? "0", 10)));
}

/**
 * Adds recruiter-facing concerns when the model leaves `overall.concerns` empty or misses obvious risks.
 */
export function enrichOverallAssessment(
  output: ValidationModelOutput,
  job: NormalizedJob,
  application: NormalizedApplication,
): ValidationModelOutput {
  const concerns = [...output.overall.concerns];
  const seen = new Set(concerns.map((item) => item.toLowerCase()));

  const addConcern = (message: string, prepend = false) => {
    const key = message.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      if (prepend) {
        concerns.unshift(message);
      } else {
        concerns.push(message);
      }
    }
  };

  const logisticsFindings = assessApplicationLogistics(job, application.candidate);
  const logisticsOrdered = [
    ...logisticsFindings.filter((f) => f.severity === "deal_breaker"),
    ...logisticsFindings.filter((f) => f.severity === "warning"),
    ...logisticsFindings.filter((f) => f.severity === "info"),
  ];
  for (const finding of [...logisticsOrdered].reverse()) {
    addConcern(logisticsFindingToConcern(finding), true);
  }

  const experienceText = collectExperienceText(output, application);
  const years = maxYearsMentioned(experienceText);
  if (years != null && years >= 5 && jobTargetsJuniorExperience(job)) {
    addConcern(
      `Candidate cites about ${years} years of experience for a junior role targeting roughly 1–2 years; confirm seniority expectations and motivation.`,
    );
  }

  const requiredMatches = output.requirementMatches.filter((match) => match.requirementType === "required");
  const weakRequired = requiredMatches.filter(
    (match) => match.judgement === "missing" || match.judgement === "unclear" || match.judgement === "claimed",
  ).length;
  if (weakRequired >= 2) {
    addConcern(
      `${weakRequired} required areas rely on weak or missing CV evidence; prioritize clarification in interview.`,
    );
  }

  const modelNiceCount = output.requirementMatches.filter(
    (match) => match.requirementType === "nice_to_have",
  ).length;
  if (job.niceToHaveSkills.length > 0 && modelNiceCount === 0) {
    addConcern(
      "Nice-to-have requirements were not assessed in the model response; see requirement table for pipeline-completed rows.",
    );
  }

  if (application.cv.extractionStatus === "failed") {
    addConcern("CV text could not be extracted reliably; this evaluation may be incomplete.");
  }

  return {
    ...output,
    overall: {
      ...output.overall,
      concerns,
    },
  };
}
