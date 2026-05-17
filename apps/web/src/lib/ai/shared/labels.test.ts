import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatJudgementLabel, formatRecommendationLabel } from "./labels";

describe("labels", () => {
  it("formats recommendation enums for recruiters", () => {
    assert.equal(formatRecommendationLabel("needs_clarification"), "Needs clarification");
    assert.equal(formatRecommendationLabel("promising_match"), "Promising match");
  });

  it("formats CV judgements without GitHub wording", () => {
    assert.equal(formatJudgementLabel("supported"), "Demonstrated in CV");
    assert.equal(formatJudgementLabel("claimed"), "Stated in CV only");
  });
});
