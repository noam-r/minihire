import PocketBase from "pocketbase";

import { requireRuntimeEnv } from "./server-env";

export function getPublicPocketBase(): PocketBase {
  return new PocketBase(requireRuntimeEnv("POCKETBASE_URL"));
}

/** PocketBase auth for the public application form (create applications + email_logs only; see API rules). */
export async function getSubmissionServicePocketBase(): Promise<PocketBase> {
  const client = new PocketBase(requireRuntimeEnv("POCKETBASE_URL"));

  await client.collection("submission_service").authWithPassword(
    requireRuntimeEnv("POCKETBASE_SUBMISSION_SERVICE_EMAIL"),
    requireRuntimeEnv("POCKETBASE_SUBMISSION_SERVICE_PASSWORD"),
  );

  return client;
}
