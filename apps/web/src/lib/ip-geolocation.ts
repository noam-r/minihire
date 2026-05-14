/** Max length for IPv6 textual form (with zone) — PocketBase field uses 45. */
const MAX_SUBMISSION_IP_LEN = 45;

/**
 * HTTPS JSON API suitable for **server-side** lookups (unlike ipwho.is free tier, which returns 403
 * outside browser CORS).
 *
 * @see https://www.geojs.io/docs/v1/endpoints/geo
 */
const GEOJS_BASE = "https://get.geojs.io/v1/ip/geo";

/** Some networks throttle unknown clients; identify the app. */
const GEO_LOOKUP_USER_AGENT = "minihire/1.0 (+https://github.com/noam-r/minihire; applicant geolocation)";

const GEO_FETCH_TIMEOUT_MS = 5000;

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

type GeoJsPayload = {
  city?: string;
  region?: string;
  country?: string;
};

function logGeo(reason: string, ip: string, extra?: string): void {
  const tail = extra ? ` ${extra}` : "";
  console.warn(`[submission-ip-geolocation] ${reason} ip=${ip}${tail}`);
}

function buildLabelFromPayload(data: GeoJsPayload): string | null {
  const parts = [data.city, data.region, data.country]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  return parts.join(", ").slice(0, 200);
}

async function fetchGeoJsPayload(ip: string): Promise<{
  ok: boolean;
  status: number;
  payload?: GeoJsPayload;
  bodySnippet?: string;
  networkError?: string;
}> {
  const url = `${GEOJS_BASE}/${encodeURIComponent(ip)}.json`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": GEO_LOOKUP_USER_AGENT,
      },
      signal: AbortSignal.timeout(GEO_FETCH_TIMEOUT_MS),
    });

    const text = await res.text();
    const snippet = text.replace(/\s+/g, " ").slice(0, 200);

    if (!res.ok) {
      return { ok: false, status: res.status, bodySnippet: snippet };
    }

    let payload: GeoJsPayload;
    try {
      payload = JSON.parse(text) as GeoJsPayload;
    } catch {
      return { ok: false, status: res.status, bodySnippet: snippet };
    }

    return { ok: true, status: res.status, payload };
  } catch (e) {
    const networkError = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, networkError };
  }
}

/**
 * Best-effort city/region/country label from the submission IP.
 *
 * Uses **GeoJS** (`get.geojs.io`) over HTTPS — intended for server-side use. Response fields
 * `city`, `region`, and `country` are joined when present (max 200 characters).
 *
 * Returns **null** when the IP is private/unknown (lookup skipped), the HTTP call fails, times out,
 * the response is not JSON, or no location fields are present.
 *
 * **Operations:** If this always returns null in production, check **container egress** (security
 * group / NAT) to `get.geojs.io:443`, DNS, and server logs for lines starting with
 * `[submission-ip-geolocation]`.
 */
export async function resolveIpLocationLabel(ip: string): Promise<string | null> {
  const normalized = normalizeSubmissionIp(ip);
  if (isNonPublicOrUnknownIp(normalized)) {
    return null;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await fetchGeoJsPayload(normalized);

    if (result.networkError) {
      logGeo(
        attempt === 1 ? "fetch_error_retrying" : "fetch_error",
        normalized,
        `err=${result.networkError.slice(0, 120)}`,
      );
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      return null;
    }

    if (!result.ok || !result.payload) {
      const willRetry = attempt === 1 && result.status >= 500;
      logGeo(
        willRetry ? "http_error_will_retry" : "http_error",
        normalized,
        `http=${result.status} body=${result.bodySnippet ?? ""}`,
      );
      if (willRetry) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      return null;
    }

    const data = result.payload;
    const label = buildLabelFromPayload(data);
    if (!label) {
      logGeo("no_city_region_country", normalized, `keys=${Object.keys(data).join(",")}`);
      return null;
    }

    return label;
  }

  return null;
}
