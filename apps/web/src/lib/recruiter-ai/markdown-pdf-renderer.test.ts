import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAiReportExportMarkdown } from "./build-export-document";
import { createReportMarkdownIt } from "../markdown-report";
import { renderMarkdownTokensToPdfBuffer } from "./markdown-pdf-renderer";
import { renderReportPdfFromMarkdown } from "./render-report-pdf";

const SAMPLE_REPORT = `# AI-Assisted Candidate Evaluation

> This is an AI-assisted evaluation for recruiter review.

## Overall Metrics

- Overall fit score: 3.5 / 5
- Recommendation: Proceed with caution

## Required Skills

| Requirement | CV assessment | Confidence |
| --- | --- | --- |
| TypeScript | Demonstrated | High |
| React | Partial | Medium |
`;

describe("markdown-pdf-renderer", () => {
  it("renders a valid PDF buffer from report-shaped markdown", async () => {
    const pdf = await renderReportPdfFromMarkdown(SAMPLE_REPORT);
    assert.ok(pdf.byteLength > 500);
    assert.equal(String.fromCharCode(...pdf.subarray(0, 4)), "%PDF");
  });

  it("parses GFM tables into table tokens", () => {
    const tokens = createReportMarkdownIt().parse(SAMPLE_REPORT, {});
    assert.ok(tokens.some((token) => token.type === "table_open"));
  });

  it("renders without throwing when blockquote and lists are present", async () => {
    const tokens = createReportMarkdownIt().parse(SAMPLE_REPORT, {});
    const buffer = await renderMarkdownTokensToPdfBuffer(tokens);
    assert.ok(buffer.length > 500);
  });

  it("renders export header bullets with bold labels without a narrow column", async () => {
    const markdown = buildAiReportExportMarkdown({
      candidateName: "Test Candidate",
      contact: { email: "applicant@example.com" },
      jobTitle: "Junior Full-Stack Developer",
      companyName: "Acme",
      reportMd: "## Overall Metrics\n\n- Overall fit score: 3.5 / 5\n",
      exportedAt: new Date("2026-05-16"),
    });
    const pdf = await renderReportPdfFromMarkdown(markdown);
    assert.ok(pdf.byteLength > 800);
  });
});
