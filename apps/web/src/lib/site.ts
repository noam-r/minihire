function getOptionalEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function getCompanyName(): string {
  return getOptionalEnv("PUBLIC_COMPANY_NAME") || "Careers";
}

export function getPageTitle(pageTitle: string): string {
  return `${pageTitle} | ${getCompanyName()}`;
}
