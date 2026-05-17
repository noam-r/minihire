import "../load-env.js";

import { resolveCliStartedByUserId as resolveStartedBy } from "../../src/lib/ai/cli-started-by";
import { getSubmissionServicePocketBase } from "../../src/lib/pocketbase";

export function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

export function requireArg(flag: string): string {
  const value = getArg(flag);
  if (!value) {
    throw new Error(`Missing required argument ${flag}`);
  }
  return value;
}

export async function getCliPocketBase() {
  return getSubmissionServicePocketBase();
}

export function resolveCliStartedByUserId(): Promise<string> {
  return resolveStartedBy(getArg);
}
