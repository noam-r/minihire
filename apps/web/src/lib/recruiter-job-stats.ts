import type PocketBase from "pocketbase";

/** One lightweight query; count applications per job id in memory. */
export async function jobApplicationCounts(pb: PocketBase): Promise<Map<string, number>> {
  const rows = await pb.collection("applications").getFullList<{ job: string }>({
    fields: "job",
    requestKey: "recruiter_jobs_app_count_map",
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const jid = typeof row.job === "string" ? row.job : "";
    if (!jid) {
      continue;
    }
    map.set(jid, (map.get(jid) ?? 0) + 1);
  }
  return map;
}
