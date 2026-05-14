/**
 * Best-effort client IP for logging and rate limits.
 *
 * Behind **Cloudflare**, the TCP peer is a Cloudflare edge node (e.g. `172.69.x.x`), not the visitor.
 * Cloudflare sets **`CF-Connecting-IP`** to the original client; we read it first when present.
 * Your reverse proxy (Caddy, nginx, etc.) must **forward** incoming headers to the Node app unchanged.
 *
 * Other common headers (Fly.io, some CDNs) are checked next, then `X-Real-IP`, then the first hop of
 * `X-Forwarded-For`, then the adapter’s `clientAddress` (direct peer).
 *
 * **Security:** `CF-Connecting-IP` can be spoofed if the request reaches your origin **without** going
 * through Cloudflare. Restrict origin access to your CDN/proxy when you rely on these headers.
 */
export function getClientIpFromRequest(request: Request, clientAddress: string | undefined): string {
  const cf = firstIpFromHeaderValue(request.headers.get("cf-connecting-ip"));
  if (cf) {
    return cf;
  }

  const trueClient = firstIpFromHeaderValue(request.headers.get("true-client-ip"));
  if (trueClient) {
    return trueClient;
  }

  const fly = firstIpFromHeaderValue(request.headers.get("fly-client-ip"));
  if (fly) {
    return fly;
  }

  const realIp = firstIpFromHeaderValue(request.headers.get("x-real-ip"));
  if (realIp) {
    return realIp;
  }

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = firstIpFromHeaderValue(xff);
    if (first) {
      return first;
    }
  }

  const peer = typeof clientAddress === "string" ? clientAddress.trim() : "";
  return peer !== "" ? peer : "unknown";
}

/** First IP in a header value (handles comma-separated lists and IPv6 brackets). */
function firstIpFromHeaderValue(raw: string | null): string | undefined {
  if (raw == null) {
    return undefined;
  }
  const segment = raw.split(",")[0]?.trim();
  if (!segment) {
    return undefined;
  }
  if (segment.startsWith("[") && segment.includes("]")) {
    return segment.slice(1, segment.indexOf("]")).trim() || undefined;
  }
  return segment;
}
