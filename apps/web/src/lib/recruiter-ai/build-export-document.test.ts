import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildAiReportExportMarkdown,
  buildCandidateDossierExportMarkdown,
  buildDossierExportFilename,
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

describe("buildCandidateDossierExportMarkdown", () => {
  const baseApplication = {
    full_name: "Test Candidate",
    email: "applicant@example.com",
    phone_number: "+1 555 0100",
    location: "Berlin",
    timezone: "Europe/Berlin",
    anything_else: "Open to remote",
    cv_file: "resume.pdf",
    consent_to_store_data: true,
    submitted_at: "2026-05-10T08:00:00.000Z",
    status: "reviewing",
    id: "app123",
  };

  it("includes application, AI, and clarification sections", () => {
    const md = buildCandidateDossierExportMarkdown({
      candidateName: "Test Candidate",
      jobTitle: "Junior Dev",
      companyName: "Acme",
      contact: { email: "applicant@example.com" },
      application: baseApplication,
      reportMd: "## Overall Metrics\n\n- Overall fit score: 3.2 / 5",
      clarificationRounds: [
        {
          request: {
            id: "req1",
            status: "submitted",
            sent_at: "2026-05-12T10:00:00.000Z",
            seen_at: "2026-05-12T11:00:00.000Z",
            submitted_at: "2026-05-13T09:00:00.000Z",
          } as never,
          items: [
            { id: "i1", question_text: "Years of Go experience?", answer_text: "About 3 years." } as never,
          ],
        },
      ],
      exportedAt: new Date("2026-05-16T12:00:00Z"),
    });

    assert.match(md, /# Candidate dossier/);
    assert.match(md, /## Application/);
    assert.match(md, /Berlin/);
    assert.match(md, /## AI evaluation/);
    assert.match(md, /\*\*Overall fit score:\*\*/);
    assert.match(md, /## Clarification/);
    assert.match(md, /Years of Go experience\?/);
    assert.match(md, /\*\*Answer:\*\* About 3 years\./);
  });

  it("notes when AI and clarification are absent", () => {
    const md = buildCandidateDossierExportMarkdown({
      candidateName: "Test Candidate",
      companyName: "Acme",
      contact: { email: "applicant@example.com" },
      application: baseApplication,
      clarificationRounds: [],
    });

    assert.match(md, /No AI evaluation report is available/);
    assert.match(md, /No clarification has been requested/);
  });

  it("shows pending clarification answers for in-flight requests", () => {
    const md = buildCandidateDossierExportMarkdown({
      candidateName: "Test Candidate",
      companyName: "Acme",
      contact: { email: "applicant@example.com" },
      application: baseApplication,
      clarificationRounds: [
        {
          request: {
            id: "req2",
            status: "opened",
            sent_at: "2026-05-14T10:00:00.000Z",
          } as never,
          items: [{ id: "i2", question_text: "Availability to start?", answer_text: "" } as never],
        },
      ],
    });

    assert.match(md, /Availability to start\?/);
    assert.match(md, /Awaiting candidate response/);
  });
});

describe("buildDossierExportFilename", () => {
  it("uses dossier in the filename", () => {
    assert.equal(
      buildDossierExportFilename("Test Candidate", new Date("2026-05-16T12:00:00Z")),
      "test-candidate-dossier-2026-05-16",
    );
  });
});
