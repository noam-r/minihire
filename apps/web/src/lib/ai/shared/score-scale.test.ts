import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emphasizeScoresInExportMarkdown, formatScoreFraction } from "./score-scale";

describe("score-scale", () => {
  it("formats scores on the 0-5 scale", () => {
    assert.equal(formatScoreFraction(2.84), "2.8 / 5");
  });

  it("emphasizes numeric scores for export markdown", () => {
    const md = emphasizeScoresInExportMarkdown("- Overall fit score: 2.8 / 5\n- CV fit score: 3.0 / 5");
    assert.match(md, /\*\*2\.8\*\* \/ 5/);
    assert.match(md, /\*\*3\.0\*\* \/ 5/);
  });
});
