import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AiRunRow } from "./load-snapshot";
import { compareNewestFirst, resolveRecruiterAiState } from "./load-snapshot";

function run(partial: Partial<AiRunRow> & { id: string; status: string }): AiRunRow {
  return partial as AiRunRow;
}

describe("resolveRecruiterAiState", () => {
  it("prefers a completed run with artifacts over a newer requested id", () => {
    const result = resolveRecruiterAiState({
      runs: [
        run({
          id: "uqixlobpib4cnla",
          status: "requested",
        }),
        run({
          id: "odl9gu10vkcc77p",
          status: "complete",
          started_at: "2026-05-16 11:10:40.545Z",
          completed_at: "2026-05-16 11:11:06.456Z",
        }),
      ],
      latestValidation: { id: "val1", status: "complete", cv_fit_score: 3 } as never,
      latestReport: { id: "rep1", status: "complete" } as never,
    });

    assert.equal(result.state, "complete");
    assert.equal(result.latestRun?.id, "odl9gu10vkcc77p");
    assert.equal(result.activeRun?.id, "uqixlobpib4cnla");
    assert.equal(result.hasQueuedRun, true);
  });

  it("shows in progress when only a requested run exists", () => {
    const result = resolveRecruiterAiState({
      runs: [run({ id: "abc123requested", status: "requested" })],
      latestValidation: null,
      latestReport: null,
    });

    assert.equal(result.state, "in_progress");
    assert.equal(result.activeRun?.status, "requested");
    assert.equal(result.hasQueuedRun, false);
  });
});

describe("compareNewestFirst", () => {
  it("orders by completed_at before id", () => {
    const runs = [
      { id: "zzz", completed_at: "" },
      { id: "aaa", completed_at: "2026-05-16 11:11:06.456Z" },
    ].sort(compareNewestFirst);

    assert.equal(runs[0]?.id, "aaa");
  });
});
