import { emphasizeScoresInExportMarkdown } from "../ai/shared/score-scale";
import {
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
