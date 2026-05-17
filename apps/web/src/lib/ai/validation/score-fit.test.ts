import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { parseValidationModelOutput } from "../shared/schemas";
import { scoreFit } from "./score-fit";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../test/fixtures/validation");

describe("scoreFit", () => {
  it("computes weighted CV fit from parsed validation output", () => {
    const parsed = parseValidationModelOutput(readFileSync(join(fixtureDir, "valid-output.json"), "utf8"));
    const metrics = scoreFit({
      parsedOutput: parsed,
      job: {
        jobId: "job1",
        title: "Backend Engineer",
        descriptionMarkdown: "Build APIs",
        requiredSkills: ["Go"],
        niceToHaveSkills: ["GraphQL"],
      },
      candidate: { fullName: "Alex", githubUrl: "https://github.com/alex" },
    });

    assert.ok(metrics.overallCvFitScore > 0);
    assert.equal(metrics.requiredSkillsTotal, 1);
    assert.equal(metrics.confidence, "medium");
  });
});
