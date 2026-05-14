/** Must match PocketBase `jobs.status` select values. */
export const JOB_STATUSES = ["draft", "published", "archived"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}
