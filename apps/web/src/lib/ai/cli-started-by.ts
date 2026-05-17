import { getAdminPocketBase } from "../pocketbase";
import { runtimeEnv } from "../server-env";

/** First active admin `users` record — used only for CLI audit attribution on created runs. */
export async function lookupDefaultCliStartedByUserId(): Promise<string | null> {
  const admin = await getAdminPocketBase();
  if (!admin) {
    return null;
  }

  try {
    const user = await admin.collection("users").getFirstListItem(
      'active = true && role = "admin"',
      { sort: "created" },
    );
    return user.id;
  } catch {
    return null;
  }
}

/**
 * PocketBase requires `application_ai_runs.started_by` → `users`.
 * Portal runs use the logged-in recruiter; CLI scripts resolve in order:
 * `--started-by`, `AI_CLI_STARTED_BY_USER_ID`, then first active admin via superuser creds.
 */
export async function resolveCliStartedByUserId(
  getFlag: (flag: string) => string | undefined,
): Promise<string> {
  const fromArg = getFlag("--started-by");
  if (fromArg) {
    return fromArg;
  }

  const fromEnv = runtimeEnv("AI_CLI_STARTED_BY_USER_ID");
  if (fromEnv) {
    return fromEnv;
  }

  const fromAdmin = await lookupDefaultCliStartedByUserId();
  if (fromAdmin) {
    return fromAdmin;
  }

  throw new Error(
    "Could not determine audit user for AI runs. Pass --started-by <users-id>, set AI_CLI_STARTED_BY_USER_ID, or set POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD so the CLI can pick an active admin user.",
  );
}
