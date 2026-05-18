import type { APIRoute } from "astro";

import {
  listClarificationItemsForRequest,
  listClarificationRequestsForApplication,
} from "../../../../lib/clarification/service";
import {
  buildCandidateDossierExportMarkdown,
  buildDossierExportFilename,
  type DossierClarificationRound,
} from "../../../../lib/recruiter-ai/build-export-document";
import { loadRecruiterAiSnapshot } from "../../../../lib/recruiter-ai/load-snapshot";
import { renderReportPdfFromMarkdown } from "../../../../lib/recruiter-ai/render-report-pdf";
import { optionalApplicantUrl } from "../../../../lib/recruiter-application-display";
import { getRecruiterPocketBase } from "../../../../lib/recruiter-auth/session";
import { getCompanyName } from "../../../../lib/site";

export const prerender = false;

async function loadClarificationRounds(
  pb: Parameters<typeof listClarificationRequestsForApplication>[0],
  applicationId: string,
): Promise<DossierClarificationRound[]> {
  const requests = await listClarificationRequestsForApplication(pb, applicationId);
  const rounds: DossierClarificationRound[] = [];
  for (const request of requests) {
    try {
      const items = await listClarificationItemsForRequest(pb, request.id);
      rounds.push({ request, items });
    } catch (error) {
      console.error(`Dossier export: clarification items load failed for ${request.id}:`, error);
      rounds.push({ request, items: [] });
    }
  }
  return rounds;
}

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
    anything_else?: string;
    cv_file?: unknown;
    consent_to_store_data?: boolean;
    submitted_at?: string;
    status?: string;
    source?: string;
    submission_ip?: string;
    submission_ip_location?: string;
    user_agent?: string;
    duplicate_key?: string;
    id: string;
    expand?: { job?: { title?: string } };
  };
  try {
    record = await pb.collection("applications").getOne(id, { expand: "job" });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const [snapshot, clarificationRounds] = await Promise.all([
    loadRecruiterAiSnapshot(pb, id),
    loadClarificationRounds(pb, id),
  ]);

  const jobTitle = String(record.expand?.job?.title ?? "").trim() || undefined;
  const candidateName = String(record.full_name ?? "Candidate");
  const markdown = buildCandidateDossierExportMarkdown({
    candidateName,
    jobTitle,
    companyName: getCompanyName(),
    contact: {
      email: String(record.email ?? ""),
      phone: record.phone_number,
      location: record.location,
      timezone: record.timezone,
      githubUrl: optionalApplicantUrl(record.github_url),
      linkedinUrl: optionalApplicantUrl(record.linkedin_url),
      portfolioUrl: optionalApplicantUrl(record.portfolio_url),
    },
    application: record,
    reportMd: snapshot.latestReport?.report_md,
    clarificationRounds,
  });

  const baseName = buildDossierExportFilename(candidateName);

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
    console.error("[dossier-export]", error);
    return new Response(message, { status: 500 });
  }
};
