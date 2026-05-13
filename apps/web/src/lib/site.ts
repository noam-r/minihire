function getOptionalEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function getCompanyName(): string {
  return getOptionalEnv("PUBLIC_COMPANY_NAME") || "Careers";
}

/** Closing line for transactional emails (e.g. application received). */
export function getApplicationEmailSignOff(): string {
  return getOptionalEnv("APPLICATION_EMAIL_SIGN_OFF") || getCompanyName();
}

export function getPageTitle(pageTitle: string): string {
  return `${pageTitle} | ${getCompanyName()}`;
}
