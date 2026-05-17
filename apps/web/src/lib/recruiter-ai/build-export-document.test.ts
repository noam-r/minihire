import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAiReportExportMarkdown,
  buildExportFilename,
  emphasizeMetricLabelsInExportMarkdown,
  slugifyExportBasename,
} from "./build-export-document";

describe("buildAiReportExportMarkdown", () => {
  it("prepends export metadata and keeps report body", () => {
    const md = buildAiReportExportMarkdown({
      candidateName: "Test Candidate",
      contact: {
        email: "applicant@example.com",
        phone: "+1 555 0100",
        githubUrl: "https://github.com/example",
      },
      jobTitle: "Junior Dev",
      companyName: "Acme",
      reportMd: "## Overall Metrics\n\n- Overall fit score: 2.8 / 5\n\n## Candidate Summary\n\nBody text.",
      exportedAt: new Date("2026-05-16T12:00:00Z"),
    });

    assert.match(md, /Test Candidate/);
    assert.match(md, /Junior Dev/);
    assert.match(md, /## Contact/);
    assert.match(md, /applicant@example\.com/);
    assert.match(md, /\+1 555 0100/);
    assert.match(md, /github\.com\/example/);
    assert.match(md, /2026-05-16/);
    assert.match(md, /\*\*Overall fit score:\*\*/);
    assert.match(md, /\*\*2\.8\*\* \/ 5/);
    assert.match(md, /## Candidate Summary/);
    assert.match(md, /Body text\./);
  });

  it("includes the export disclaimer once when the stored report already has one", () => {
    const md = buildAiReportExportMarkdown({
      candidateName: "Test Candidate",
      contact: { email: "applicant@example.com" },
      companyName: "Acme",
      reportMd: [
        "# AI-Assisted Candidate Evaluation",
        "",
        "> This is an AI-assisted evaluation for recruiter review. It is not an automated hiring decision.",
        "",
        "## Overall Metrics",
        "",
        "- Overall fit score: 2.8 / 5",
      ].join("\n"),
    });

    const disclaimerMatches = md.match(/internal review aid/g) ?? [];
    assert.equal(disclaimerMatches.length, 1);
    assert.doesNotMatch(md, /not an automated hiring decision/);
  });
});

describe("slugifyExportBasename", () => {
  it("slugifies candidate names for filenames", () => {
    assert.equal(slugifyExportBasename("Test Candidate"), "test-candidate");
  });
});

describe("emphasizeMetricLabelsInExportMarkdown", () => {
  it("bolds overall metrics labels", () => {
    const md = emphasizeMetricLabelsInExportMarkdown("- Overall fit score: **2.8** / 5");
    assert.match(md, /\*\*Overall fit score:\*\* \*\*2\.8\*\*/);
  });
});

describe("buildExportFilename", () => {
  it("starts with the candidate slug and includes the export date", () => {
    assert.equal(
      buildExportFilename("Test Candidate", new Date("2026-05-16T12:00:00Z")),
      "test-candidate-ai-evaluation-2026-05-16",
    );
  });
});
