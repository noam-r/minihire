/** Must match PocketBase `applications.status` select values. */
export const APPLICATION_STATUSES = [
  "new",
  "reviewing",
  "maybe",
  "rejected",
  "interview",
  "offer",
  "hired",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}
