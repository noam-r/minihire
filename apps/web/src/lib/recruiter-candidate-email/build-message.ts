import { getApplicationEmailSignOff } from "../site";

export function buildCandidateEmailPlainText(input: {
  candidateName: string;
  body: string;
}): string {
  const name = input.candidateName.trim();
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const signOff = getApplicationEmailSignOff();

  return `${greeting}

${input.body.trim()}

${signOff}`;
}
