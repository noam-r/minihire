import type PocketBase from "pocketbase";

import {
  downloadCvBytes,
  loadApplication,
  loadJob,
  mapNormalizedJob,
  type ApplicationRecord,
} from "../pocketbase";
import { NORMALIZATION_VERSION } from "../shared/versions";
import type { CvFormat, NormalizedApplication, NormalizedJob } from "../shared/types";
import { detectCvFormat } from "./detect-cv-format";
import { extractMarkdownCv } from "./extract-markdown-cv";
import { extractPdfCv } from "./extract-pdf-cv";

export async function normalizeApplication(input: {
  pb: PocketBase;
  applicationId: string;
}): Promise<{ job: NormalizedJob; application: ApplicationRecord; normalized: NormalizedApplication }> {
  const application = await loadApplication(input.pb, input.applicationId);
  if (!application.consent_to_store_data) {
    throw new Error("Application has not consented to data storage");
  }

  const jobRecord = await loadJob(input.pb, application.job);
  const job = mapNormalizedJob(jobRecord);

  const { fileName, bytes, mimeType } = await downloadCvBytes(input.pb, application);
  const format: CvFormat = detectCvFormat(fileName, mimeType);

  let extractedMarkdown = "";
  let extractionStatus: "success" | "failed" = "failed";
  let extractionWarnings: string[] = [];
  let wordCount = 0;

  if (format === "pdf") {
    const pdfResult = await extractPdfCv({ fileName, bytes });
    extractedMarkdown = pdfResult.markdown;
    extractionStatus = pdfResult.status;
    extractionWarnings = pdfResult.warnings;
    wordCount = pdfResult.wordCount;
  } else {
    try {
      const mdResult = await extractMarkdownCv({ fileName, bytes });
      extractedMarkdown = mdResult.markdown;
      extractionStatus = "success";
      extractionWarnings = mdResult.warnings;
      wordCount = mdResult.wordCount;
    } catch (error) {
      extractionStatus = "failed";
      extractionWarnings = [
        error instanceof Error ? error.message : "Could not read uploaded CV text",
      ];
    }
  }

  const normalized: NormalizedApplication = {
    applicationId: application.id,
    jobId: job.jobId,
    candidate: {
      fullName: application.full_name,
      location: application.location,
      timezone: application.timezone,
      phoneNumber: application.phone_number,
      githubUrl: application.github_url,
      portfolioUrl: application.portfolio_url,
      linkedinUrl: application.linkedin_url,
      anythingElse: application.anything_else,
    },
    cv: {
      originalFileName: fileName,
      originalFormat: format,
      extractedMarkdown,
      extractionStatus,
      extractionWarnings,
      wordCount,
    },
    normalizedAt: new Date().toISOString(),
    normalizationVersion: NORMALIZATION_VERSION,
  };

  return { job, application, normalized };
}
