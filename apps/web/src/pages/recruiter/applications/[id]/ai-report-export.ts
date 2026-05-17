import type { APIRoute } from "astro";

import {
  buildAiReportExportMarkdown,
  buildExportFilename,
} from "../../../../lib/recruiter-ai/build-export-document";
import { loadRecruiterAiSnapshot } from "../../../../lib/recruiter-ai/load-snapshot";
import { renderReportPdfFromMarkdown } from "../../../../lib/recruiter-ai/render-report-pdf";
import { optionalApplicantUrl } from "../../../../lib/recruiter-application-display";
import { getRecruiterPocketBase } from "../../../../lib/recruiter-auth/session";
import { getCompanyName } from "../../../../lib/site";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id) {
    return new Response("Not found", { status: 404 });
  }

  const format = context.url.searchParams.get("format");
  if (format !== "markdown" && format !== "pdf") {
    return new Response('Query parameter "format" must be "markdown" or "pdf".', { status: 400 });
  }

  const session = context.locals.recruiter ?? (await getRecruiterPocketBase(context));
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { pb } = session;

  let record: {
    full_name: string;
    email: string;
    phone_number?: string;
    location?: string;
    timezone?: string;
    github_url?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    expand?: { job?: { title?: string } };
  };
  try {
    record = await pb.collection("applications").getOne(id, { expand: "job" });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const snapshot = await loadRecruiterAiSnapshot(pb, id);
  const reportMd = snapshot.latestReport?.report_md;
  if (!reportMd?.trim()) {
    return new Response("No evaluation report available for this application.", { status: 404 });
  }

  const jobTitle = String(record.expand?.job?.title ?? "").trim() || undefined;
  const markdown = buildAiReportExportMarkdown({
    candidateName: String(record.full_name ?? "Candidate"),
    contact: {
      email: String(record.email ?? ""),
      phone: record.phone_number,
      location: record.location,
      timezone: record.timezone,
      githubUrl: optionalApplicantUrl(record.github_url),
      linkedinUrl: optionalApplicantUrl(record.linkedin_url),
      portfolioUrl: optionalApplicantUrl(record.portfolio_url),
    },
    jobTitle,
    companyName: getCompanyName(),
    reportMd,
  });

  const baseName = buildExportFilename(String(record.full_name ?? "Candidate"));

  if (format === "markdown") {
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.md"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  try {
    const pdf = await renderReportPdfFromMarkdown(markdown);
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF export failed";
    console.error("[ai-report-export]", error);
    return new Response(message, { status: 500 });
  }
};
