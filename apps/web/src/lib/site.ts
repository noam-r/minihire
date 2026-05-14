import { runtimeEnv } from "./server-env";

export function getCompanyName(): string {
  return runtimeEnv("PUBLIC_COMPANY_NAME") || "Careers";
}

/** Closing line for transactional emails (e.g. application received). */
export function getApplicationEmailSignOff(): string {
  return runtimeEnv("APPLICATION_EMAIL_SIGN_OFF") || getCompanyName();
}

export function getPageTitle(pageTitle: string): string {
  return `${pageTitle} | ${getCompanyName()}`;
}
