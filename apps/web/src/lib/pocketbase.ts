import PocketBase from "pocketbase";

function getRequiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPublicPocketBase(): PocketBase {
  return new PocketBase(getRequiredEnv("POCKETBASE_URL"));
}

/** PocketBase auth for the public application form (create applications + email_logs only; see API rules). */
export async function getSubmissionServicePocketBase(): Promise<PocketBase> {
  const client = new PocketBase(getRequiredEnv("POCKETBASE_URL"));

  await client.collection("submission_service").authWithPassword(
    getRequiredEnv("POCKETBASE_SUBMISSION_SERVICE_EMAIL"),
    getRequiredEnv("POCKETBASE_SUBMISSION_SERVICE_PASSWORD"),
  );

  return client;
}
