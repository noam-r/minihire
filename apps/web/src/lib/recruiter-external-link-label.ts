/** Short anchor text for recruiter-facing external URLs (full URL in `title`). */
export function externalLinkAnchorText(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "Open link";
  }
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (host.includes("linkedin.")) {
      return "Open LinkedIn";
    }
    if (host.includes("github.")) {
      return "Open GitHub";
    }
    if (host.includes("gitlab.")) {
      return "Open GitLab";
    }
    return "Open link";
  } catch {
    return "Open link";
  }
}
