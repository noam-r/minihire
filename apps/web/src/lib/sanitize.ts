export function trimText(value: FormDataEntryValue | string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeShortText(value: FormDataEntryValue | string | null | undefined): string {
  return collapseWhitespace(trimText(value));
}

export function normalizeEmail(value: FormDataEntryValue | string | null | undefined): string {
  return trimText(value).toLowerCase();
}

export function normalizeLongText(value: FormDataEntryValue | string | null | undefined): string {
  return trimText(value);
}

export function splitLinesToList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((item) => collapseWhitespace(item))
    .filter(Boolean);
}

export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return collapseWhitespace(error.message).slice(0, 500);
  }

  return "Unknown error";
}
