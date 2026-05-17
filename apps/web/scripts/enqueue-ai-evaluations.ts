#!/usr/bin/env tsx
import "./load-env.js";

import { ClientResponseError } from "pocketbase";

import { enqueueEvaluationRuns } from "../src/lib/ai/pipeline/enqueue-evaluation-runs";
import { getArg, getCliPocketBase, resolveCliStartedByUserId } from "./ai/_cli";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseLimit(): number | undefined {
  const raw = getArg("--limit");
  if (raw == null || raw === "") {
    return undefined;
  }
  const limit = Number.parseInt(raw, 10);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer");
  }
  return limit;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const limit = parseLimit();
  const startedByUserId = resolveCliStartedByUserId();
  const pb = await getCliPocketBase();

  const result = await enqueueEvaluationRuns(pb, {
    startedByUserId,
    dryRun,
    limit,
  });

  console.log(JSON.stringify(result, null, 2));

  if (!dryRun && result.queued > 0) {
    console.error(
      `Queued ${result.queued} evaluation run(s). Process with: pnpm ai:worker -- --once (or wait for cron).`,
    );
  }
}

main().catch((error) => {
  if (error instanceof ClientResponseError) {
    console.error("PocketBase error:", JSON.stringify(error.response, null, 2));
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
