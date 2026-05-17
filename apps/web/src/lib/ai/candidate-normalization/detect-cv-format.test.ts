import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { detectCvFormat } from "./detect-cv-format";

describe("detectCvFormat", () => {
  it("detects pdf from extension and mime", () => {
    assert.equal(detectCvFormat("resume.pdf", "application/pdf"), "pdf");
    assert.equal(detectCvFormat("cv.PDF", "application/octet-stream"), "pdf");
  });

  it("treats markdown and text as markdown path", () => {
    assert.equal(detectCvFormat("cv.md", "text/markdown"), "markdown");
    assert.equal(detectCvFormat("notes.txt", "text/plain"), "markdown");
  });
});
