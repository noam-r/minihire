import type PocketBase from "pocketbase";

import type { ApplicationRecord } from "../../applications";
import { applicationHasAiScores } from "../../recruiter-applications-list";
import type { AiRunRow } from "../../recruiter-ai/load-snapshot";
import { findActiveRun } from "../../recruiter-ai/load-snapshot";
import { createEvaluationRun } from "./process-evaluation-run";

export type EnqueueSkipReason = "has_scores" | "active_run";

export type EnqueueEvaluationCandidate = {
  applicationId: string;
  fullName: string;
  skipReason?: EnqueueSkipReason;
};

export type EnqueueEvaluationRunsResult = {
  examined: number;
  queued: number;
  skipped: number;
  deferredDueToLimit: number;
  dryRun: boolean;
  items: Array<{
    applicationId: string;
    fullName: string;
    action: "queued" | "would_queue" | "skipped";
    skipReason?: EnqueueSkipReason;
    runId?: string;
  }>;
};

export function selectApplicationsToEnqueue(
  applications: ApplicationRecord[],
  runsByApplication: Map<string, AiRunRow[]>,
): { toEnqueue: ApplicationRecord[]; skipped: EnqueueEvaluationCandidate[] } {
  const toEnqueue: ApplicationRecord[] = [];
  const skipped: EnqueueEvaluationCandidate[] = [];

  for (const application of applications) {
    const fullName = application.full_name?.trim() || application.id;

    if (applicationHasAiScores(application)) {
      skipped.push({
        applicationId: application.id,
        fullName,
        skipReason: "has_scores",
      });
      continue;
    }

    const runs = runsByApplication.get(application.id) ?? [];
    if (findActiveRun(runs)) {
      skipped.push({
        applicationId: application.id,
        fullName,
        skipReason: "active_run",
      });
      continue;
    }

    toEnqueue.push(application);
  }

  return { toEnqueue, skipped };
}

export function groupRunsByApplication(runs: AiRunRow[]): Map<string, AiRunRow[]> {
  const map = new Map<string, AiRunRow[]>();
  for (const run of runs) {
    const applicationId = typeof run.application === "string" ? run.application : "";
    if (!applicationId) {
      continue;
    }
    const list = map.get(applicationId) ?? [];
    list.push(run);
    map.set(applicationId, list);
  }
  return map;
}

export async function enqueueEvaluationRuns(
  pb: PocketBase,
  input: {
    startedByUserId: string;
    dryRun?: boolean;
    limit?: number;
  },
): Promise<EnqueueEvaluationRunsResult> {
  const dryRun = input.dryRun ?? false;
  const limit = input.limit != null && input.limit > 0 ? input.limit : undefined;

  const [applications, runs] = await Promise.all([
    pb.collection("applications").getFullList<ApplicationRecord>({
      requestKey: "enqueue_ai_evaluations_applications",
    }),
    pb.collection("application_ai_runs").getFullList<AiRunRow>({
      requestKey: "enqueue_ai_evaluations_runs",
    }),
  ]);

  const runsByApplication = groupRunsByApplication(runs);
  const { toEnqueue, skipped } = selectApplicationsToEnqueue(applications, runsByApplication);

  const batch = limit != null ? toEnqueue.slice(0, limit) : toEnqueue;
  const deferredDueToLimit = limit != null ? Math.max(0, toEnqueue.length - limit) : 0;

  const items: EnqueueEvaluationRunsResult["items"] = [];

  for (const candidate of skipped) {
    items.push({
      applicationId: candidate.applicationId,
      fullName: candidate.fullName,
      action: "skipped",
      skipReason: candidate.skipReason,
    });
  }

  let queued = 0;

  for (const application of batch) {
    const fullName = application.full_name?.trim() || application.id;

    if (dryRun) {
      items.push({
        applicationId: application.id,
        fullName,
        action: "would_queue",
      });
      queued += 1;
      continue;
    }

    const runId = await createEvaluationRun(pb, {
      applicationId: application.id,
      startedByUserId: input.startedByUserId,
      runType: "cv_validation",
    });

    items.push({
      applicationId: application.id,
      fullName,
      action: "queued",
      runId,
    });
    queued += 1;
  }

  return {
    examined: applications.length,
    queued,
    skipped: skipped.length,
    deferredDueToLimit,
    dryRun,
    items,
  };
}
