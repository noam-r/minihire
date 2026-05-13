const ONE_HOUR_MS = 60 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;

const requestsByIp = new Map<string, number[]>();

export function isRateLimited(ipAddress: string, now = Date.now()): boolean {
  const existing = requestsByIp.get(ipAddress) ?? [];
  const recent = existing.filter((timestamp) => now - timestamp < ONE_HOUR_MS);

  if (recent.length >= MAX_SUBMISSIONS_PER_WINDOW) {
    requestsByIp.set(ipAddress, recent);
    return true;
  }

  recent.push(now);
  requestsByIp.set(ipAddress, recent);
  return false;
}
