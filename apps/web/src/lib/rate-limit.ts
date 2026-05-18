const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const MAX_CLARIFICATION_SUBMITS_PER_WINDOW = 10;

const requestsByKey = new Map<string, number[]>();

function isRateLimitedForKey(key: string, maxPerWindow: number, now = Date.now()): boolean {
  const existing = requestsByKey.get(key) ?? [];
  const recent = existing.filter((timestamp) => now - timestamp < ONE_HOUR_MS);

  if (recent.length >= maxPerWindow) {
    requestsByKey.set(key, recent);
    return true;
  }

  recent.push(now);
  requestsByKey.set(key, recent);
  return false;
}

export function isRateLimited(ipAddress: string, now = Date.now()): boolean {
  return isRateLimitedForKey(`apply:${ipAddress}`, MAX_SUBMISSIONS_PER_WINDOW, now);
}

export function isClarificationSubmitRateLimited(ipAddress: string, now = Date.now()): boolean {
  return isRateLimitedForKey(
    `clarification-submit:${ipAddress}`,
    MAX_CLARIFICATION_SUBMITS_PER_WINDOW,
    now,
  );
}
