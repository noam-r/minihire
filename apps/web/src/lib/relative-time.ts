const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

/**
 * Human-readable English relative time for recruiter UI (server-rendered at request time).
 */
export function formatRelativeTime(iso: string | undefined | null, now: Date = new Date()): string {
  if (iso == null || iso === "") {
    return "—";
  }
  const then = new Date(iso);
  const t = then.getTime();
  if (Number.isNaN(t)) {
    return "—";
  }
  const diffMs = now.getTime() - t;
  if (diffMs < 0) {
    return "just now";
  }
  if (diffMs < 45_000) {
    return "just now";
  }
  if (diffMs < MS_HOUR) {
    const m = Math.max(1, Math.floor(diffMs / MS_MIN));
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diffMs < MS_DAY) {
    const h = Math.max(1, Math.floor(diffMs / MS_HOUR));
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 14 * MS_DAY) {
    const d = Math.floor(diffMs / MS_DAY);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  return then.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function jobPostingTimingLine(job: unknown, now: Date = new Date()): string {
  const j = job as Record<string, unknown>;
  const status = typeof j.status === "string" ? j.status : "";
  const pub = j.publishedAt;
  if (status === "published") {
    if (typeof pub === "string" && pub.trim() !== "") {
      return `Published ${formatRelativeTime(pub, now)}`;
    }
    return "Published (no publish date set)";
  }
  if (status === "draft") {
    return "Draft — not on the public careers site";
  }
  if (status === "archived") {
    return "Archived";
  }
  return "";
}
