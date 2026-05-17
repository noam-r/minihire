import type { CvFormat } from "../shared/types";

export function detectCvFormat(fileName: string, mimeType: string): CvFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType.includes("pdf")) {
    return "pdf";
  }
  return "markdown";
}
