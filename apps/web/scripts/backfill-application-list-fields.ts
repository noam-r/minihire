#!/usr/bin/env tsx
/**
 * One-time backfill for applications inbox list fields (AI scores, status_changed_at).
 *
 * Prerequisites:
 *   1. Migrations applied (restart PocketBase after deploy):
 *      - 1747067000_application_list_fields.js
 *      - 1747067100_applications_service_list_field_updates.js
 *   2. Run: pnpm --filter web backfill:application-list-fields
 */
import "./load-env.js";

import { ClientResponseError } from "pocketbase";
import type PocketBase from "pocketbase";

import { resolveAiEvaluatedAt, syncApplicationAiScores } from "../src/lib/ai/pipeline/store-artifacts";
import type { ApplicationRecord } from "../src/lib/applications";
import { getAdminPocketBase, getSubmissionServicePocketBase } from "../src/lib/pocketbase";
import { applicationHasAiScores } from "../src/lib/recruiter-applications-list";
import { loadRecruiterAiSnapshot } from "../src/lib/recruiter-ai/load-snapshot";

async function getBackfillPocketBase(): Promise<PocketBase> {
  const admin = await getAdminPocketBase();
  if (admin) {
    return admin;
  }
  return getSubmissionServicePocketBase();
}

async function assertCanUpdateApplications(pb: PocketBase): Promise<void> {
  const sample = await pb.collection("applications").getList<ApplicationRecord>(1, 1);
  const record = sample.items[0];
  if (!record) {
    return;
  }

  try {
    await pb.collection("applications").update(record.id, {
      cv_fit_score: record.cv_fit_score ?? null,
    });
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new Error(
        "Cannot update applications: PocketBase API rules are stale. " +
          "Restart PocketBase so migration 1747067100_applications_service_list_field_updates.js is loaded, " +
          "or set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD in .env for superuser backfill.",
      );
    }
    throw error;
  }
}

async function main() {
  const pb = await getBackfillPocketBase();
  await assertCanUpdateApplications(pb);

  const applications = await pb.collection("applications").getFullList<ApplicationRecord>({
    requestKey: "backfill_application_list_fields",
  });

  let scoresUpdated = 0;
  let statusDatesUpdated = 0;

  for (const application of applications) {
    if (!application.status_changed_at && application.submitted_at) {
      await pb.collection("applications").update(application.id, {
        status_changed_at: application.submitted_at,
      });
      statusDatesUpdated += 1;
    }

    const snapshot = await loadRecruiterAiSnapshot(pb, application.id);
    const report = snapshot.latestReport;
    const evaluatedAt = resolveAiEvaluatedAt(
      snapshot.latestRun?.completed_at,
      snapshot.latestRun?.started_at,
      report?.created,
      snapshot.latestValidation?.created,
    );

    if (report && (report.cv_fit_score != null || report.status === "complete" || report.status === "partial")) {
      await syncApplicationAiScores(pb, {
        applicationId: application.id,
        cvFitScore: report.cv_fit_score ?? snapshot.latestValidation?.cv_fit_score,
        requiredSkillsScore:
          report.required_skills_score ?? snapshot.latestValidation?.required_skills_score,
        niceToHaveScore: report.nice_to_have_score ?? snapshot.latestValidation?.nice_to_have_score,
        evaluatedAt,
      });
      scoresUpdated += 1;
      continue;
    }

    if (snapshot.latestValidation?.cv_fit_score != null) {
      await syncApplicationAiScores(pb, {
        applicationId: application.id,
        cvFitScore: snapshot.latestValidation.cv_fit_score,
        requiredSkillsScore: snapshot.latestValidation.required_skills_score,
        niceToHaveScore: snapshot.latestValidation.nice_to_have_score,
        evaluatedAt,
      });
      scoresUpdated += 1;
      continue;
    }

    if (!application.ai_evaluated_at && applicationHasAiScores(application)) {
      await syncApplicationAiScores(pb, {
        applicationId: application.id,
        cvFitScore: application.cv_fit_score,
        requiredSkillsScore: application.required_skills_score,
        niceToHaveScore: application.nice_to_have_score,
        evaluatedAt,
      });
      scoresUpdated += 1;
    }
  }

  console.log(
    JSON.stringify({
      applications: applications.length,
      statusDatesUpdated,
      scoresUpdated,
    }),
  );
}

main().catch((error) => {
  if (error instanceof ClientResponseError) {
    console.error("PocketBase error:", JSON.stringify(error.response, null, 2));
  }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
