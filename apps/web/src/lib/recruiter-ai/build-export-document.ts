import type {
  ClarificationItemRecord,
  ClarificationRequestRecord,
} from "../clarification/types";
import { emphasizeScoresInExportMarkdown } from "../ai/shared/score-scale";
import {
  cvFilename,
  formatConsent,
  formatSubmittedAt,
  NOT_PROVIDED,
  optionalApplicantText,
  optionalApplicantUrl,
  requiredApplicantText,
} from "../recruiter-application-display";
import { AI_DISCLAIMER, stripEmbeddedReportDisclaimer } from "./display";

export type ExportCandidateContact = {
  email: string;
  phone?: string;
  location?: string;
  timezone?: string;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
};

export function slugifyExportBasename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "candidate";
}

export function buildExportFilename(candidateName: string, exportedAt?: Date): string {
  const datePart = (exportedAt ?? new Date()).toISOString().slice(0, 10);
  return `${slugifyExportBasename(candidateName)}-ai-evaluation-${datePart}`;
}

export function buildDossierExportFilename(candidateName: string, exportedAt?: Date): string {
  const datePart = (exportedAt ?? new Date()).toISOString().slice(0, 10);
  return `${slugifyExportBasename(candidateName)}-dossier-${datePart}`;
}

export type DossierClarificationRound = {
  request: ClarificationRequestRecord;
  items: ClarificationItemRecord[];
};

export type DossierApplicationRecord = {
  full_name?: string;
  email?: string;
  phone_number?: string;
  location?: string;
  timezone?: string;
  github_url?: string;
  portfolio_url?: string;
  linkedin_url?: string;
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
  id?: string;
};

function markdownField(label: string, value: string): string {
  return `- **${label}:** ${value}`;
}

function formatClarificationRoundStatus(request: ClarificationRequestRecord): string {
  if (request.status === "cancelled" && request.cancel_reason === "candidate_email_failed") {
    return "Email not delivered";
  }
  switch (request.status) {
    case "sent":
      return "Waiting for candidate";
    case "opened":
      return "Waiting for answers";
    case "submitted":
      return "Completed";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return request.status;
  }
}

function buildApplicationExportSection(application: DossierApplicationRecord): string[] {
  return [
    "## Application",
    "",
    "### Candidate details",
    "",
    markdownField("Full name", requiredApplicantText(application.full_name)),
    markdownField("Email", requiredApplicantText(application.email)),
    markdownField("Phone", optionalApplicantText(application.phone_number)),
    markdownField("Location", optionalApplicantText(application.location)),
    markdownField("Timezone", optionalApplicantText(application.timezone)),
    markdownField("GitHub", optionalApplicantUrl(application.github_url) ?? NOT_PROVIDED),
    markdownField("Portfolio", optionalApplicantUrl(application.portfolio_url) ?? NOT_PROVIDED),
    markdownField("LinkedIn", optionalApplicantUrl(application.linkedin_url) ?? NOT_PROVIDED),
    markdownField("Anything else", optionalApplicantText(application.anything_else)),
    markdownField("CV / resume", cvFilename(application.cv_file)),
    markdownField("Consent to store data", formatConsent(application.consent_to_store_data)),
    "",
    "### Submission context",
    "",
    markdownField("Applied", formatSubmittedAt(application.submitted_at)),
    markdownField("Pipeline status", requiredApplicantText(application.status)),
    markdownField("Source", optionalApplicantText(application.source)),
    markdownField("Submission IP", optionalApplicantText(application.submission_ip)),
    markdownField("Approximate location (from IP)", optionalApplicantText(application.submission_ip_location)),
    markdownField("Browser (user agent)", optionalApplicantText(application.user_agent)),
    markdownField("Duplicate submission key", optionalApplicantText(application.duplicate_key)),
    markdownField("Record ID", optionalApplicantText(application.id)),
  ];
}

function buildClarificationExportSection(rounds: DossierClarificationRound[]): string[] {
  const lines = ["## Clarification", ""];

  const exportableRounds = rounds.filter(({ items }) => items.length > 0);
  if (!exportableRounds.length) {
    lines.push("_No clarification has been requested for this application._", "");
    return lines;
  }

  const sorted = [...exportableRounds].sort((a, b) => {
    const ta = Date.parse(String(a.request.sent_at ?? ""));
    const tb = Date.parse(String(b.request.sent_at ?? ""));
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
      return tb - ta;
    }
    return b.request.id.localeCompare(a.request.id);
  });

  sorted.forEach(({ request, items }, index) => {
    const roundLabel =
      sorted.length > 1 ? `### Clarification round ${sorted.length - index}` : "### Clarification request";
    lines.push(roundLabel, "");
    lines.push(
      markdownField("Status", formatClarificationRoundStatus(request)),
      markdownField("Sent", formatSubmittedAt(request.sent_at)),
      markdownField("Opened", request.seen_at ? formatSubmittedAt(request.seen_at) : NOT_PROVIDED),
    );
    if (request.status === "submitted") {
      lines.push(markdownField("Submitted", formatSubmittedAt(request.submitted_at)));
    }
    lines.push("", "#### Questions and answers", "");

    items.forEach((item, itemIndex) => {
      lines.push(`**${itemIndex + 1}.** ${item.question_text}`, "");
      const answer = String(item.answer_text ?? "").trim();
      if (request.status === "submitted") {
        lines.push(`**Answer:** ${answer || NOT_PROVIDED}`, "");
      } else {
        lines.push("**Answer:** _Awaiting candidate response._", "");
      }
    });
  });

  return lines;
}

function buildAiExportSection(reportMd: string | null | undefined): string[] {
  const lines = ["## AI evaluation", ""];
  if (!reportMd?.trim()) {
    lines.push("_No AI evaluation report is available for this application._", "");
    return lines;
  }
  lines.push(`> ${AI_DISCLAIMER}`, "");
  lines.push(stripEmbeddedReportDisclaimer(reportMd).trim(), "");
  return lines;
}

export function buildCandidateDossierExportMarkdown(input: {
  candidateName: string;
  jobTitle?: string;
  companyName: string;
  contact: ExportCandidateContact;
  application: DossierApplicationRecord;
  reportMd?: string | null;
  clarificationRounds: DossierClarificationRound[];
  exportedAt?: Date;
}): string {
  const exportedOn = (input.exportedAt ?? new Date()).toISOString().slice(0, 10);
  const sections = [
    "# Candidate dossier",
    "",
    `- **Candidate:** ${input.candidateName}`,
    ...(input.jobTitle ? [`- **Role:** ${input.jobTitle}`] : []),
    `- **Exported:** ${exportedOn}`,
    `- **Organization:** ${input.companyName}`,
    "",
    "---",
    "",
    ...buildApplicationExportSection(input.application),
    "",
    "---",
    "",
    ...buildAiExportSection(input.reportMd),
    "",
    "---",
    "",
    ...buildClarificationExportSection(input.clarificationRounds),
  ];

  const body = sections.join("\n").trimEnd() + "\n";
  return emphasizeMetricLabelsInExportMarkdown(emphasizeScoresInExportMarkdown(body));
}

function formatContactUrlLine(label: string, url: string | null | undefined): string {
  const value = optionalApplicantUrl(url) ?? NOT_PROVIDED;
  return `- **${label}:** ${value}`;
}

export function buildExportContactLines(contact: ExportCandidateContact): string[] {
  return [
    `- **Email:** ${requiredApplicantText(contact.email)}`,
    `- **Phone:** ${optionalApplicantText(contact.phone)}`,
    `- **Location:** ${optionalApplicantText(contact.location)}`,
    `- **Timezone:** ${optionalApplicantText(contact.timezone)}`,
    formatContactUrlLine("GitHub", contact.githubUrl),
    formatContactUrlLine("LinkedIn", contact.linkedinUrl),
    formatContactUrlLine("Portfolio", contact.portfolioUrl),
  ];
}

export function buildAiReportExportMarkdown(input: {
  candidateName: string;
  contact: ExportCandidateContact;
  jobTitle?: string;
  companyName: string;
  reportMd: string;
  exportedAt?: Date;
}): string {
  const exportedOn = (input.exportedAt ?? new Date()).toISOString().slice(0, 10);
  const headerLines = [
    "# AI evaluation report (export)",
    "",
    `- **Candidate:** ${input.candidateName}`,
    ...(input.jobTitle ? [`- **Role:** ${input.jobTitle}`] : []),
    "",
    "## Contact",
    "",
    ...buildExportContactLines(input.contact),
    "",
    `- **Exported:** ${exportedOn}`,
    `- **Organization:** ${input.companyName}`,
    "",
    `> ${AI_DISCLAIMER}`,
    "",
    "---",
    "",
  ];

  const reportBody = stripEmbeddedReportDisclaimer(input.reportMd);
  const body = `${headerLines.join("\n")}\n${reportBody}\n`;
  return emphasizeMetricLabelsInExportMarkdown(emphasizeScoresInExportMarkdown(body));
}

const METRIC_LABELS = [
  "Overall fit score",
  "CV fit score",
  "Required skills coverage",
  "Nice-to-have coverage",
  "Confidence",
  "Recommendation",
] as const;

/** Bold metric labels in export output (PDF has no score bars). */
export function emphasizeMetricLabelsInExportMarkdown(markdown: string): string {
  let result = markdown;
  for (const label of METRIC_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`^- (${escaped}):`, "gm"), `- **${label}:**`);
  }
  return result;
}
