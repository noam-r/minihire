import assert from "node:assert/strict";
import { describe, it } from "node:test";

import PocketBase from "pocketbase";

import {
  applicationHasAiLogisticsWarnings,
  applicationHasAiScores,
  applicationsListQueryString,
  buildApplicationsListFilter,
  buildApplicationsListSort,
  buildClarificationListFilterClause,
  formatClarificationInboxDisplay,
  parseApplicationsListParams,
  sortLinkParams,
} from "./recruiter-applications-list";

describe("parseApplicationsListParams", () => {
  it("defaults sort and direction", () => {
    const params = parseApplicationsListParams(new URLSearchParams());
    assert.equal(params.sort, "submitted");
    assert.equal(params.dir, "desc");
    assert.equal(params.page, 1);
  });

  it("parses filters and sort", () => {
    const params = parseApplicationsListParams(
      new URLSearchParams(
        "page=2&sort=cv_fit&dir=asc&q=search&job=job1&status=reviewing&clarification=waiting&starred=1",
      ),
    );
    assert.equal(params.page, 2);
    assert.equal(params.sort, "cv_fit");
    assert.equal(params.dir, "asc");
    assert.equal(params.q, "search");
    assert.equal(params.job, "job1");
    assert.equal(params.status, "reviewing");
    assert.equal(params.clarification, "waiting");
    assert.equal(params.starred, "1");
  });

  it("ignores invalid starred filter values", () => {
    const params = parseApplicationsListParams(new URLSearchParams("starred=yes"));
    assert.equal(params.starred, "");
  });
});

describe("buildApplicationsListFilter", () => {
  const pb = new PocketBase();

  it("returns undefined when no filters", () => {
    assert.equal(
      buildApplicationsListFilter(pb, { q: "", job: "", status: "", clarification: "", starred: "" }),
      undefined,
    );
  });

  it("combines search, job, and status clauses", () => {
    const filter = buildApplicationsListFilter(pb, {
      q: "applicant@",
      job: "job123",
      status: "new",
      clarification: "",
      starred: "",
    });
    assert.match(filter!, /full_name ~ "applicant@"/);
    assert.match(filter!, /email ~ "applicant@"/);
    assert.match(filter!, /job = ['"]job123['"]/);
    assert.match(filter!, /status = ['"]new['"]/);
  });

  it("adds clarification filter clause", () => {
    const filter = buildApplicationsListFilter(pb, {
      q: "",
      job: "",
      status: "",
      clarification: "waiting",
      starred: "",
    });
    assert.match(filter!, /clarification_status = "requested"/);
    assert.match(filter!, /clarification_status = "seen"/);
  });

  it("adds starred filter clause", () => {
    const filter = buildApplicationsListFilter(pb, {
      q: "",
      job: "",
      status: "",
      clarification: "",
      starred: "1",
    });
    assert.match(filter!, /starred = true/);
  });
});

describe("buildClarificationListFilterClause", () => {
  it("maps inbox filters to PocketBase clauses", () => {
    assert.match(buildClarificationListFilterClause("none"), /clarification_status = "none"/);
    assert.match(buildClarificationListFilterClause("answered"), /answered/);
    assert.match(buildClarificationListFilterClause("needs_followup"), /expired/);
    assert.match(buildClarificationListFilterClause("needs_followup"), /cancelled/);
  });
});

describe("formatClarificationInboxDisplay", () => {
  it("maps primary clarification states", () => {
    assert.deepEqual(formatClarificationInboxDisplay("none"), {
      variant: "empty",
      label: "—",
    });
    assert.deepEqual(formatClarificationInboxDisplay("requested"), {
      variant: "waiting",
      label: "Waiting for candidate",
    });
    assert.deepEqual(formatClarificationInboxDisplay("seen"), {
      variant: "waiting",
      label: "Waiting for candidate",
    });
    assert.deepEqual(formatClarificationInboxDisplay("answered"), {
      variant: "answered",
      label: "Answers received",
    });
  });

  it("maps attention states for expired and cancelled", () => {
    assert.equal(formatClarificationInboxDisplay("expired").variant, "attention");
    assert.equal(formatClarificationInboxDisplay("cancelled").label, "Send failed");
  });
});

describe("buildApplicationsListSort", () => {
  it("maps sort fields to PocketBase sort strings", () => {
    assert.equal(buildApplicationsListSort({ sort: "submitted", dir: "desc" }), "-submitted_at");
    assert.equal(buildApplicationsListSort({ sort: "updated", dir: "asc" }), "status_changed_at");
    assert.equal(buildApplicationsListSort({ sort: "cv_fit", dir: "desc" }), "-cv_fit_score");
  });
});

describe("applicationsListQueryString", () => {
  it("serializes active filters", () => {
    const qs = applicationsListQueryString({
      page: 2,
      sort: "required",
      dir: "asc",
      q: "test",
      job: "jid",
      status: "maybe",
      clarification: "answered",
      starred: "1",
    });
    assert.match(qs, /page=2/);
    assert.match(qs, /sort=required/);
    assert.match(qs, /dir=asc/);
    assert.match(qs, /q=test/);
    assert.match(qs, /clarification=answered/);
    assert.match(qs, /starred=1/);
  });
});

describe("applicationHasAiScores", () => {
  it("is true when ai_evaluated_at is set", () => {
    assert.equal(applicationHasAiScores({ ai_evaluated_at: "2026-05-16 12:00:00.000Z" }), true);
  });

  it("is true for legacy rows with denormalized scores but no timestamp", () => {
    assert.equal(
      applicationHasAiScores({
        cv_fit_score: 2.8,
        required_skills_score: 3.1,
        nice_to_have_score: 1,
      }),
      true,
    );
  });

  it("is false when unevaluated (empty timestamp and zero placeholders)", () => {
    assert.equal(applicationHasAiScores({ ai_evaluated_at: "" }), false);
    assert.equal(applicationHasAiScores({}), false);
    assert.equal(
      applicationHasAiScores({
        cv_fit_score: 0,
        required_skills_score: 0,
        nice_to_have_score: 0,
      }),
      false,
    );
  });
});

describe("applicationHasAiLogisticsWarnings", () => {
  it("is true for Israel onsite job with India candidate", () => {
    assert.equal(
      applicationHasAiLogisticsWarnings({
        ai_evaluated_at: "2026-05-16T12:00:00.000Z",
        location: "Bangalore, India",
        timezone: "Asia/Kolkata",
        phone_number: "+91 98765 43210",
        expand: {
          job: {
            id: "job1",
            title: "Engineer",
            description: "Tel Aviv",
            workModel: "onsite",
            workLocation: "Israel",
          },
        },
      }),
      true,
    );
  });

  it("is false when not evaluated", () => {
    assert.equal(
      applicationHasAiLogisticsWarnings({
        location: "India",
        expand: { job: { id: "j1", workModel: "onsite", workLocation: "Israel" } },
      }),
      false,
    );
  });
});

describe("sortLinkParams", () => {
  it("toggles direction for the active column", () => {
    const current = parseApplicationsListParams(new URLSearchParams("sort=cv_fit&dir=desc"));
    const toggled = sortLinkParams(current, "cv_fit");
    assert.equal(toggled.dir, "asc");
    assert.equal(toggled.page, 1);
  });

  it("switches column with desc as default", () => {
    const current = parseApplicationsListParams(new URLSearchParams("sort=submitted"));
    const next = sortLinkParams(current, "nice_to_have");
    assert.equal(next.sort, "nice_to_have");
    assert.equal(next.dir, "desc");
  });
});
