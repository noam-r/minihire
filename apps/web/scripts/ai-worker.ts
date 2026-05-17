#!/usr/bin/env tsx
import "./load-env.js";

import { ClientResponseError } from "pocketbase";

import { findRequestedAiRuns } from "../src/lib/ai/pocketbase";
import { processEvaluationRun } from "../src/lib/ai/pipeline/process-evaluation-run";
import { getCliPocketBase, getArg } from "./ai/_cli";

async function main() {
  const once = process.argv.includes("--once");
  const limit = Number.parseInt(getArg("--limit") ?? "5", 10);
  const pb = await getCliPocketBase();

  const runs = await findRequestedAiRuns(pb, limit);
  if (!runs.length) {
    console.log(JSON.stringify({ processed: 0 }));
    return;
  }

  const results: Array<{ runId: string; status: string; error?: string }> = [];

  for (const run of runs) {
    try {
      const result = await processEvaluationRun(pb, run.id);
      results.push(result);
      console.log(`[ai-worker] run ${run.id} -> ${result.status}`);
    } catch (error) {
      const message = formatWorkerError(error);
      results.push({ runId: run.id, status: "failed", error: message });
      console.error(`[ai-worker] run ${run.id} failed: ${message}`);
    }
  }

  console.log(JSON.stringify({ processed: results.length, results }));

  if (!once) {
    console.error("Use --once for a single poll batch, or run via cron/systemd on a schedule.");
  }
}

function formatWorkerError(error: unknown): string {
  if (error instanceof ClientResponseError && error.response?.data) {
    const details = Object.entries(error.response.data)
      .map(([field, issue]) => {
        const msg =
          issue && typeof issue === "object" && "message" in issue
            ? String((issue as { message?: string }).message)
            : JSON.stringify(issue);
        return `${field}: ${msg}`;
      })
      .join("; ");
    if (details) {
      return `${error.message} (${details})`;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: unknown }).response;
    console.error("PocketBase error:", JSON.stringify(response, null, 2));
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
