#!/usr/bin/env tsx
import "./load-env.js";

/**
 * Runs validation only (requires existing successful normalization or re-normalizes first).
 * Prefer `ai:evaluate` for the full async-shaped pipeline.
 */
import { normalizeApplication } from "../src/lib/ai/candidate-normalization/normalize-application";
import { canRunValidation, VALIDATION_SKIP_REASON } from "../src/lib/ai/pipeline/can-run-validation";
import { storeValidation } from "../src/lib/ai/pipeline/store-artifacts";
import { requireAiConfig } from "../src/lib/ai/config";
import { validateCandidate } from "../src/lib/ai/validation/validate-candidate";
import { getCliPocketBase, requireArg } from "./ai/_cli";

async function main() {
  const applicationId = requireArg("--application");
  const pb = await getCliPocketBase();

  const { job, normalized } = await normalizeApplication({ pb, applicationId });

  if (!canRunValidation(normalized)) {
    const record = await storeValidation(pb, {
      applicationId,
      jobId: job.jobId,
      status: "skipped",
      errorMessage: VALIDATION_SKIP_REASON,
    });
    console.log(JSON.stringify({ validationId: record.id, status: "skipped" }));
    return;
  }

  const config = requireAiConfig();
  const result = await validateCandidate({ config, job, application: normalized });

  const record = await storeValidation(pb, {
    applicationId,
    jobId: job.jobId,
    status: "complete",
    model: result.model,
    rawModelOutput: safeParseJson(result.rawModelOutput),
    parsedOutput: result.parsedOutput,
    metrics: result.metrics,
    summary: result.parsedOutput.candidateSummary,
  });

  console.log(JSON.stringify({ validationId: record.id, status: "complete", metrics: result.metrics }));
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { text: raw };
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
