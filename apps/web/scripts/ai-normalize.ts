#!/usr/bin/env tsx
import "./load-env.js";

import { normalizeApplication } from "../src/lib/ai/candidate-normalization/normalize-application";
import { storeNormalization } from "../src/lib/ai/pipeline/store-artifacts";
import { getCliPocketBase, requireArg } from "./ai/_cli";

async function main() {
  const applicationId = requireArg("--application");
  const pb = await getCliPocketBase();

  const { job, normalized } = await normalizeApplication({ pb, applicationId });
  const status = normalized.cv.extractionStatus === "success" ? "complete" : "failed";

  const record = await storeNormalization(pb, {
    applicationId,
    jobId: job.jobId,
    normalized,
    status,
    errorMessage: status === "failed" ? normalized.cv.extractionWarnings[0] : undefined,
  });

  console.log(JSON.stringify({ normalizationId: record.id, status, wordCount: normalized.cv.wordCount }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
