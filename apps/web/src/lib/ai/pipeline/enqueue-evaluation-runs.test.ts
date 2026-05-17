import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ApplicationRecord } from "../../applications";
import type { AiRunRow } from "../../recruiter-ai/load-snapshot";
import { groupRunsByApplication, selectApplicationsToEnqueue } from "./enqueue-evaluation-runs";

function app(id: string, overrides: Partial<ApplicationRecord> = {}): ApplicationRecord {
  return {
    id,
    job: "job1",
    full_name: `Candidate ${id}`,
    email: `${id}@example.com`,
    status: "new",
    duplicate_key: `${id}@example.com:job1`,
    ...overrides,
  } as ApplicationRecord;
}

function run(applicationId: string, status: string): AiRunRow {
  return {
    id: `run-${applicationId}-${status}`,
    application: applicationId,
    run_type: "cv_validation",
    status,
    started_by: "user1",
  } as AiRunRow;
}

describe("selectApplicationsToEnqueue", () => {
  it("queues applications without scores and without active runs", () => {
    const applications = [app("a1"), app("a2"), app("a3", { ai_evaluated_at: "2026-01-01" })];
    const runs = groupRunsByApplication([run("a2", "requested")]);

    const { toEnqueue, skipped } = selectApplicationsToEnqueue(applications, runs);

    assert.equal(toEnqueue.length, 1);
    assert.equal(toEnqueue[0]?.id, "a1");
    assert.equal(skipped.length, 2);
    assert.ok(skipped.some((s) => s.applicationId === "a2" && s.skipReason === "active_run"));
    assert.ok(skipped.some((s) => s.applicationId === "a3" && s.skipReason === "has_scores"));
  });

  it("treats running status as active", () => {
    const applications = [app("a1")];
    const runs = groupRunsByApplication([run("a1", "running")]);

    const { toEnqueue, skipped } = selectApplicationsToEnqueue(applications, runs);

    assert.equal(toEnqueue.length, 0);
    assert.equal(skipped[0]?.skipReason, "active_run");
  });
});

describe("groupRunsByApplication", () => {
  it("groups runs by application id", () => {
    const map = groupRunsByApplication([run("a1", "complete"), run("a2", "failed"), run("a1", "requested")]);
    assert.equal(map.get("a1")?.length, 2);
    assert.equal(map.get("a2")?.length, 1);
  });
});
