import type { AiConfig } from "../config";
import { completeJson } from "../providers";
import { truncateForLlm } from "../shared/truncate";
import type { CvFitMetrics, NormalizedApplication, NormalizedJob, ValidationModelOutput, ValidationPrompt } from "../shared/types";
import { buildValidationPrompt } from "./build-validation-prompt";
import { enrichOverallAssessment } from "./enrich-overall-assessment";
import { ensureRequirementCoverage } from "./ensure-requirement-coverage";
import { parseValidationResult } from "./parse-validation-result";
import { scoreFit } from "./score-fit";

export async function validateCandidate(input: {
  config: AiConfig;
  job: NormalizedJob;
  application: NormalizedApplication;
}): Promise<{
  prompt: ValidationPrompt;
  rawModelOutput: string;
  parsedOutput: ValidationModelOutput;
  metrics: CvFitMetrics;
  model: string;
  provider: string;
}> {
  const { text: cvMarkdown } = truncateForLlm(
    input.application.cv.extractedMarkdown,
    input.config.maxCvChars,
  );

  const prompt = buildValidationPrompt({
    job: input.job,
    application: input.application,
    cvMarkdown,
  });

  const completion = await completeJson(input.config, {
    system: prompt.system,
    user: prompt.user,
    responseFormat: "json",
  });

  let parsedOutput = parseValidationResult(completion.text);
  parsedOutput = ensureRequirementCoverage(parsedOutput, input.job);
  parsedOutput = enrichOverallAssessment(parsedOutput, input.job, input.application);
  const metrics = scoreFit({
    parsedOutput,
    job: input.job,
    candidate: input.application.candidate,
  });

  return {
    prompt,
    rawModelOutput: completion.text,
    parsedOutput,
    metrics,
    model: completion.model,
    provider: completion.provider,
  };
}
