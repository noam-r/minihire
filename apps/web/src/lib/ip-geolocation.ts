/** Max length for IPv6 textual form (with zone) — PocketBase field uses 45. */
const MAX_SUBMISSION_IP_LEN = 45;

const IP_WHO_IS_BASE = "https://ipwho.is";

/**
 * Truncate and trim the IP we persist on the application record.
 */
export function normalizeSubmissionIp(ip: string): string {
  return ip.trim().slice(0, MAX_SUBMISSION_IP_LEN);
}

/**
 * Skip third-party lookup for obvious non-public addresses and placeholders.
 */
export function isNonPublicOrUnknownIp(ip: string): boolean {
  const s = ip.trim().toLowerCase();
  if (!s || s === "unknown") {
    return true;
  }
  if (s === "::1" || s === "0:0:0:0:0:0:0:1") {
    return true;
  }
  if (s.startsWith("127.")) {
    return true;
  }
  if (s.startsWith("10.")) {
    return true;
  }
  if (s.startsWith("192.168.")) {
    return true;
  }
  if (s.startsWith("172.")) {
    const parts = s.split(".");
    if (parts.length >= 2) {
      const octet = Number(parts[1]);
      if (Number.isFinite(octet) && octet >= 16 && octet <= 31) {
        return true;
      }
    }
  }
  // IPv6 unique local / link-local (prefix checks only).
  if (s.startsWith("fc") || s.startsWith("fd")) {
    return true;
  }
  if (s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb")) {
    return true;
  }
  return false;
}

type IpWhoIsPayload = {
  success?: boolean;
  city?: string;
  region?: string;
  country?: string;
};

/**
 * Best-effort city/region/country label from the submission IP.
 *
 * Implementation: **HTTPS GET** to `https://ipwho.is/<ip>` (no API key). The JSON includes
 * `city`, `region` (e.g. state), and `country`; we join whichever are non-empty (max 200 chars).
 *
 * Returns **null** when the IP is private/unknown (lookup skipped), the HTTP call fails, times out
 * (2.5s), `success` is false, or no location fields are present. **CDN edge IPs** (e.g. wrong
 * client IP) may still return a datacenter/POP city — use `getClientIpFromRequest` so the stored
 * IP is the real visitor when behind Cloudflare.
 */
export async function resolveIpLocationLabel(ip: string): Promise<string | null> {
  const normalized = normalizeSubmissionIp(ip);
  if (isNonPublicOrUnknownIp(normalized)) {
    return null;
  }

  const url = `${IP_WHO_IS_BASE}/${encodeURIComponent(normalized)}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as IpWhoIsPayload;
    if (data.success === false) {
      return null;
    }

    const parts = [data.city, data.region, data.country]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return null;
    }

    return parts.join(", ").slice(0, 200);
  } catch {
    return null;
  }
}
