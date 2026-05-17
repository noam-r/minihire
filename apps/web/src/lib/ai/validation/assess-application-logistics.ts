import type { NormalizedJob } from "../shared/types";

export type LogisticsSeverity = "deal_breaker" | "warning" | "info";

export type LogisticsFinding = {
  severity: LogisticsSeverity;
  code: string;
  title: string;
  detail: string;
};

type RegionId = string;

type RegionDef = {
  id: RegionId;
  label: string;
  aliases: RegExp[];
  phonePrefixes: string[];
  timezoneHints: string[];
};

const REGION_DEFS: RegionDef[] = [
  {
    id: "israel",
    label: "Israel",
    aliases: [
      /\bisrael\b/i,
      /\btel\s*aviv\b/i,
      /\bhaifa\b/i,
      /\bjerusalem\b/i,
      /\bherzliya\b/i,
      /\bra'anana\b/i,
      /\bnetanya\b/i,
    ],
    phonePrefixes: ["972"],
    timezoneHints: ["asia/jerusalem", "israel"],
  },
  {
    id: "india",
    label: "India",
    aliases: [
      /\bindia\b/i,
      /\bbangalore\b/i,
      /\bbengaluru\b/i,
      /\bmumbai\b/i,
      /\bdelhi\b/i,
      /\bhyderabad\b/i,
      /\bchennai\b/i,
      /\bkolkata\b/i,
      /\bpune\b/i,
      /\bgurgaon\b/i,
      /\bnoida\b/i,
    ],
    phonePrefixes: ["91"],
    timezoneHints: ["asia/kolkata", "asia/calcutta"],
  },
  {
    id: "us",
    label: "United States",
    aliases: [
      /\bunited states\b/i,
      /\bu\.?s\.?a\.?\b/i,
      /\bnew york\b/i,
      /\bsan francisco\b/i,
      /\bcalifornia\b/i,
      /\bseattle\b/i,
      /\baustin\b/i,
    ],
    phonePrefixes: ["1"],
    timezoneHints: ["america/new_york", "america/los_angeles", "america/chicago"],
  },
  {
    id: "uk",
    label: "United Kingdom",
    aliases: [/\bunited kingdom\b/i, /\buk\b/i, /\blondon\b/i, /\bengland\b/i],
    phonePrefixes: ["44"],
    timezoneHints: ["europe/london"],
  },
  {
    id: "eu",
    label: "Europe (EU)",
    aliases: [/\beuropean union\b/i, /\beu\b/i, /\bberlin\b/i, /\bparis\b/i, /\bamsterdam\b/i],
    phonePrefixes: ["33", "49", "34", "39", "31"],
    timezoneHints: ["europe/berlin", "europe/paris"],
  },
];

function inferRegionsFromText(text: string | undefined): Set<RegionId> {
  const found = new Set<RegionId>();
  if (!text?.trim()) {
    return found;
  }
  const haystack = text.toLowerCase();
  for (const region of REGION_DEFS) {
    if (region.aliases.some((pattern) => pattern.test(haystack))) {
      found.add(region.id);
    }
  }
  return found;
}

function inferRegionsFromTimezone(timezone: string | undefined): Set<RegionId> {
  const found = new Set<RegionId>();
  if (!timezone?.trim()) {
    return found;
  }
  const normalized = timezone.trim().toLowerCase();
  for (const region of REGION_DEFS) {
    if (region.timezoneHints.some((hint) => normalized.includes(hint))) {
      found.add(region.id);
    }
  }
  return found;
}

function inferRegionsFromPhone(phone: string | undefined): Set<RegionId> {
  const found = new Set<RegionId>();
  if (!phone?.trim()) {
    return found;
  }
  const digits = phone.replace(/\D/g, "");
  if (!digits.length) {
    return found;
  }

  for (const region of REGION_DEFS) {
    for (const prefix of region.phonePrefixes) {
      if (digits.startsWith(prefix) && digits.length >= prefix.length + 6) {
        found.add(region.id);
      }
    }
  }
  return found;
}

function mergeRegions(...sets: Set<RegionId>[]): Set<RegionId> {
  const merged = new Set<RegionId>();
  for (const set of sets) {
    for (const id of set) {
      merged.add(id);
    }
  }
  return merged;
}

function setsDisjoint(a: Set<RegionId>, b: Set<RegionId>): boolean {
  if (!a.size || !b.size) {
    return false;
  }
  for (const id of a) {
    if (b.has(id)) {
      return false;
    }
  }
  return true;
}

function regionLabels(ids: Set<RegionId>): string {
  const labels = [...ids]
    .map((id) => REGION_DEFS.find((r) => r.id === id)?.label ?? id)
    .sort();
  return labels.join(", ") || "unknown";
}

function requiresOnSiteAttendance(workModel: string | undefined): boolean {
  const model = workModel?.toLowerCase().trim();
  return model === "hybrid" || model === "onsite";
}

function formatWorkModelLabel(workModel: string | undefined): string {
  const model = workModel?.toLowerCase().trim();
  if (model === "hybrid") return "Hybrid";
  if (model === "onsite") return "On-site";
  if (model === "remote") return "Remote";
  return workModel?.trim() || "Not specified";
}

export function logisticsFindingToConcern(finding: LogisticsFinding): string {
  return `${finding.title}: ${finding.detail}`;
}

export type LogisticsCandidateFields = {
  location?: string;
  timezone?: string;
  phoneNumber?: string;
};

export function assessApplicationLogistics(
  job: NormalizedJob,
  candidate: LogisticsCandidateFields,
): LogisticsFinding[] {
  const findings: LogisticsFinding[] = [];

  const jobText = [job.workLocation, job.title, job.descriptionMarkdown.slice(0, 4000)]
    .filter(Boolean)
    .join("\n");
  const jobRegions = inferRegionsFromText(jobText);

  const candidateRegions = mergeRegions(
    inferRegionsFromText(candidate.location),
    inferRegionsFromTimezone(candidate.timezone),
  );
  const phoneRegions = inferRegionsFromPhone(candidate.phoneNumber);

  const onSiteRequired = requiresOnSiteAttendance(job.workModel);
  const workModelLabel = formatWorkModelLabel(job.workModel);
  const jobLocationLabel = job.workLocation?.trim() || regionLabels(jobRegions) || "not specified";
  const candidateLocationLabel =
    candidate.location?.trim() ||
    regionLabels(candidateRegions) ||
    candidate.timezone?.trim() ||
    "not specified";

  if (jobRegions.size && candidateRegions.size && setsDisjoint(jobRegions, candidateRegions)) {
    const severity: LogisticsSeverity = onSiteRequired
      ? "deal_breaker"
      : job.workModel?.toLowerCase() === "remote"
        ? "info"
        : "warning";

    findings.push({
      severity,
      code: onSiteRequired ? "location_mismatch_onsite" : "location_mismatch",
      title: onSiteRequired
        ? "Location mismatch — on-site or hybrid role"
        : "Location mismatch with job region",
      detail: `Job (${workModelLabel}): ${jobLocationLabel} (${regionLabels(jobRegions)}). Candidate: ${candidateLocationLabel}${candidate.timezone ? ` (${candidate.timezone})` : ""}.`,
    });
  } else if (
    onSiteRequired &&
    jobRegions.size &&
    candidate.timezone &&
    !candidate.location?.trim()
  ) {
    const tzRegions = inferRegionsFromTimezone(candidate.timezone);
    if (tzRegions.size && setsDisjoint(jobRegions, tzRegions)) {
      findings.push({
        severity: "deal_breaker",
        code: "timezone_mismatch_onsite",
        title: "Timezone mismatch — on-site or hybrid role",
        detail: `Job (${workModelLabel}): ${jobLocationLabel} (${regionLabels(jobRegions)}). Candidate timezone: ${candidate.timezone} (${regionLabels(tzRegions)}).`,
      });
    }
  }

  if (jobRegions.size && phoneRegions.size && setsDisjoint(jobRegions, phoneRegions)) {
    const hasLocationDealBreaker = findings.some((f) => f.severity === "deal_breaker");
    findings.push({
      severity: hasLocationDealBreaker ? "deal_breaker" : "warning",
      code: "phone_region_mismatch",
      title: "Phone country code does not match job location",
      detail: `Job region: ${regionLabels(jobRegions)}. Phone (${candidate.phoneNumber?.trim() || "provided"}) suggests ${regionLabels(phoneRegions)}.`,
    });
  }

  return findings;
}

export function hasLogisticsDealBreaker(findings: LogisticsFinding[]): boolean {
  return findings.some((f) => f.severity === "deal_breaker");
}
