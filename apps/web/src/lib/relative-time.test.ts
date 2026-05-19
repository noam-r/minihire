import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDateTimeTooltip, formatRelativeTime } from "./relative-time";

describe("formatDateTimeTooltip", () => {
  it("returns a localized date-time string for valid ISO input", () => {
    const tooltip = formatDateTimeTooltip("2026-05-18T10:22:37.000Z");
    assert.match(tooltip, /2026/);
    assert.match(tooltip, /22/);
  });

  it("returns empty string when input is missing or invalid", () => {
    assert.equal(formatDateTimeTooltip(""), "");
    assert.equal(formatDateTimeTooltip(null), "");
    assert.equal(formatDateTimeTooltip("not-a-date"), "");
  });
});

describe("formatRelativeTime", () => {
  it("returns relative label for recent timestamps", () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    assert.equal(formatRelativeTime("2026-05-18T10:00:00.000Z", now), "1 day ago");
  });
});
