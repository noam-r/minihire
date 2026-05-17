#!/usr/bin/env tsx
import "./load-env.js";

import { createEvaluationRun, processEvaluationRun } from "../src/lib/ai/pipeline/process-evaluation-run";
import { getCliPocketBase, getArg, requireArg, resolveCliStartedByUserId } from "./ai/_cli";

async function main() {
  const applicationId = requireArg("--application");
  const runIdArg = getArg("--run");
  const pb = await getCliPocketBase();

  const runId =
    runIdArg ??
    (await createEvaluationRun(pb, {
      applicationId,
      startedByUserId: await resolveCliStartedByUserId(),
      runType: "cv_validation",
    }));

  const result = await processEvaluationRun(pb, runId);
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
