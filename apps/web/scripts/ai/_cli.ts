import "../load-env.js";

import { getSubmissionServicePocketBase } from "../../src/lib/pocketbase";
import { runtimeEnv } from "../../src/lib/server-env";

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

export function resolveCliStartedByUserId(): string {
  const fromArg = getArg("--started-by");
  const fromEnv = runtimeEnv("AI_CLI_STARTED_BY_USER_ID");
  const id = fromArg ?? fromEnv;
  if (!id) {
    throw new Error(
      "Pass --started-by <users-id> or set AI_CLI_STARTED_BY_USER_ID (PocketBase users record for audit)",
    );
  }
  return id;
}
