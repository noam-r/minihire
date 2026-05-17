import PocketBase from "pocketbase";

import { requireRuntimeEnv, runtimeEnv } from "./server-env";

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

/** Superuser API access for one-off CLI scripts (e.g. backfill). Not used by the web app. */
export async function getAdminPocketBase(): Promise<PocketBase | null> {
  const email = runtimeEnv("POCKETBASE_ADMIN_EMAIL");
  const password = runtimeEnv("POCKETBASE_ADMIN_PASSWORD");
  if (!email || !password) {
    return null;
  }

  const client = new PocketBase(requireRuntimeEnv("POCKETBASE_URL"));
  try {
    await client.collection("_superusers").authWithPassword(email, password);
    return client;
  } catch {
    return null;
  }
}
