import { createReportMarkdownIt } from "../markdown-report";
import { renderMarkdownTokensToPdfBuffer } from "./markdown-pdf-renderer";

export async function renderReportPdfFromMarkdown(markdown: string): Promise<Uint8Array> {
  const tokens = createReportMarkdownIt().parse(markdown, {});
  const buffer = await renderMarkdownTokensToPdfBuffer(tokens);
  return new Uint8Array(buffer);
}
