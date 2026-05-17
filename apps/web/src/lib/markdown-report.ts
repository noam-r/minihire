import MarkdownIt from "markdown-it";
import { markdownItTable } from "markdown-it-table";

export function createReportMarkdownIt(): MarkdownIt {
  return new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
  }).use(markdownItTable);
}

export function renderReportMarkdownHtml(markdown: string): string {
  return createReportMarkdownIt().render(markdown);
}
