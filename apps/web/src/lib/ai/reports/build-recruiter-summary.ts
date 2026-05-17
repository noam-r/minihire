import { formatRecommendationLabel, formatJudgementLabel, formatConfidenceLabel } from "../shared/labels";
import { formatScoreFraction } from "../shared/score-scale";
import { assessApplicationLogistics } from "../validation/assess-application-logistics";
import { buildEvaluationRationaleInput } from "./build-evaluation-rationale";
import type {
  CandidateEvaluationMetrics,
  CvFitMetrics,
  NormalizedApplication,
  NormalizedJob,
  ValidationModelOutput,
} from "../shared/types";

export function buildRecruiterSummary(input: {
  application: NormalizedApplication;
  job: NormalizedJob;
  validation?: ValidationModelOutput;
  cvMetrics: CvFitMetrics;
  candidateMetrics: CandidateEvaluationMetrics;
  provider?: string;
  model?: string;
}): string {
  const v = input.validation;
  const logisticsFindings = assessApplicationLogistics(input.job, input.application.candidate);
  const criticalFindings = logisticsFindings.filter(
    (f) => f.severity === "deal_breaker" || f.severity === "warning",
  );

  const serverRationale = buildEvaluationRationaleInput({
    cvMetrics: input.cvMetrics,
    candidateMetrics: input.candidateMetrics,
    normalized: input.application,
    job: input.job,
  });
  const lines: string[] = [
    "# AI-Assisted Candidate Evaluation",
    "",
  ];

  if (criticalFindings.length) {
    lines.push("## Critical findings", "");
    for (const finding of criticalFindings) {
      lines.push(`- **${finding.title}:** ${finding.detail}`);
    }
    lines.push("");
  }

  lines.push(
    "## Overall Metrics",
    "",
    `- Overall fit score: ${formatScoreFraction(input.candidateMetrics.overallFitScore)}`,
    `- CV fit score: ${formatScoreFraction(input.cvMetrics.overallCvFitScore)}`,
    `- Required skills coverage: ${formatRequiredCoverageLine(input)}`,
    `- Nice-to-have coverage: ${formatNiceToHaveCoverageLine(input)}`,
    `- Confidence: ${formatConfidenceLabel(input.candidateMetrics.confidence)}`,
    `- Recommendation: ${formatRecommendationLabel(input.candidateMetrics.recommendation)}`,
    "",
    "## Assessment transparency",
    "",
    "### Confidence rationale",
    "",
    v?.overall.confidenceRationale?.trim() || "_Not available for this evaluation run._",
    "",
    "### Why this advisory label",
    "",
    serverRationale.recommendationExplanation,
    "",
    "### How scores were calculated",
    "",
  );

  for (const line of serverRationale.scoreBullets) {
    lines.push(`- ${line}`);
  }

  if (serverRationale.flagLabels.length) {
    lines.push("", "### Assessment flags", "");
    for (const label of serverRationale.flagLabels) {
      lines.push(`- ${label}`);
    }
  }

  lines.push(
    "",
    "## Candidate Summary",
    "",
    v?.candidateSummary || "_No validation summary available._",
    "",
    "## Strengths",
    "",
  );

  for (const item of v?.overall.strengths ?? []) {
    lines.push(`- ${item}`);
  }
  if (!v?.overall.strengths?.length) {
    lines.push("- _None listed._");
  }

  lines.push("", "## Gaps", "");
  for (const item of v?.overall.gaps ?? []) {
    lines.push(`- ${item}`);
  }
  if (!v?.overall.gaps?.length) {
    lines.push("- _None listed._");
  }

  lines.push("", "## Concerns", "");
  for (const item of v?.overall.concerns ?? []) {
    lines.push(`- ${item}`);
  }
  if (!v?.overall.concerns?.length) {
    lines.push("- _None listed._");
  }

  lines.push("", "## Required Skills", "");
  appendRequirementTable(lines, v, "required");

  lines.push("", "## Nice-to-Have Skills", "");
  appendRequirementTable(lines, v, "nice_to_have");

  lines.push("", "## GitHub Evidence", "", "_Not collected in this evaluation run._", "");

  lines.push("## Claims vs Evidence", "", "_GitHub comparison not run._", "");

  lines.push("", "## Suggested Interview Questions", "");
  for (const q of v?.overall.suggestedInterviewQuestions ?? []) {
    lines.push(`- ${q}`);
  }
  if (!v?.overall.suggestedInterviewQuestions?.length) {
    lines.push("- _None listed._");
  }

  lines.push("", "## Processing Metadata", "");
  lines.push(`- Application: ${input.application.applicationId}`);
  lines.push(`- Job: ${input.job.title} (${input.job.jobId})`);
  lines.push(`- CV format: ${input.application.cv.originalFormat}`);
  lines.push(`- CV extraction: ${input.application.cv.extractionStatus}`);
  if (input.provider) {
    lines.push(`- Provider: ${input.provider}`);
  }
  if (input.model) {
    lines.push(`- Model: ${input.model}`);
  }
  if (input.candidateMetrics.flags.length) {
    lines.push(`- Flags: ${input.candidateMetrics.flags.join(", ")}`);
  }

  return lines.join("\n");
}

function appendRequirementTable(
  lines: string[],
  validation: ValidationModelOutput | undefined,
  type: "required" | "nice_to_have",
): void {
  const matches = validation?.requirementMatches.filter((m) => m.requirementType === type) ?? [];
  if (!matches.length) {
    lines.push("_No requirements evaluated._");
    return;
  }

  lines.push("| Requirement | CV assessment | Confidence | Reasoning |");
  lines.push("| --- | --- | --- | --- |");
  for (const match of matches) {
    lines.push(
      `| ${escapeCell(match.requirement)} | ${escapeCell(formatJudgementLabel(match.judgement))} | ${formatConfidenceLabel(match.confidence)} | ${escapeCell(match.reasoning?.trim() || "—")} |`,
    );
  }
}

function formatRequiredCoverageLine(input: {
  validation?: ValidationModelOutput;
  cvMetrics: CvFitMetrics;
}): string {
  const evaluated =
    input.validation?.requirementMatches.filter((m) => m.requirementType === "required").length ?? 0;
  if (evaluated === 0) {
    return "Not evaluated";
  }
  return `${formatScoreFraction(input.cvMetrics.requiredSkillsScore)} (${input.cvMetrics.requiredSkillsMatched} of ${evaluated} requirements with demonstrated or partial CV evidence)`;
}

function formatNiceToHaveCoverageLine(input: {
  validation?: ValidationModelOutput;
  cvMetrics: CvFitMetrics;
}): string {
  const evaluated =
    input.validation?.requirementMatches.filter((m) => m.requirementType === "nice_to_have").length ?? 0;
  if (evaluated === 0) {
    return "Not evaluated";
  }
  return `${formatScoreFraction(input.cvMetrics.niceToHaveSkillsScore)} (${input.cvMetrics.niceToHaveSkillsMatched} of ${evaluated} nice-to-have items assessed)`;
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|");
}
