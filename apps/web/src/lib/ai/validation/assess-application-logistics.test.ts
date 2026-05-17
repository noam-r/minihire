import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessApplicationLogistics,
  hasLogisticsDealBreaker,
} from "./assess-application-logistics";
import type { NormalizedJob } from "../shared/types";

const israelOnsiteJob: NormalizedJob = {
  jobId: "j1",
  title: "Backend Engineer",
  descriptionMarkdown: "Join our team in Tel Aviv.",
  requiredSkills: ["Node.js"],
  niceToHaveSkills: [],
  workModel: "onsite",
  workLocation: "Israel",
};

describe("assessApplicationLogistics", () => {
  it("flags deal-breaker for Israel onsite job with India candidate and +91 phone", () => {
    const findings = assessApplicationLogistics(israelOnsiteJob, {
      location: "Bangalore, India",
      timezone: "Asia/Kolkata",
      phoneNumber: "+91 98765 43210",
    });

    assert.ok(hasLogisticsDealBreaker(findings));
    assert.ok(findings.some((f) => f.code === "location_mismatch_onsite"));
    assert.ok(findings.some((f) => f.code === "phone_region_mismatch"));
  });

  it("downgrades location mismatch for remote Israel job", () => {
    const findings = assessApplicationLogistics(
      { ...israelOnsiteJob, workModel: "remote" },
      { location: "India", timezone: "Asia/Kolkata" },
    );

    const locationFinding = findings.find((f) => f.code === "location_mismatch");
    assert.ok(locationFinding);
    assert.equal(locationFinding.severity, "info");
    assert.equal(hasLogisticsDealBreaker(findings), false);
  });

  it("returns no findings when regions align", () => {
    const findings = assessApplicationLogistics(israelOnsiteJob, {
      location: "Tel Aviv, Israel",
      timezone: "Asia/Jerusalem",
      phoneNumber: "+972 50 123 4567",
    });

    assert.equal(findings.length, 0);
  });

  it("returns nothing when regions cannot be inferred", () => {
    const findings = assessApplicationLogistics(
      { ...israelOnsiteJob, workLocation: "", descriptionMarkdown: "Great role." },
      { location: "", timezone: "", phoneNumber: "" },
    );

    assert.equal(findings.length, 0);
  });
});
