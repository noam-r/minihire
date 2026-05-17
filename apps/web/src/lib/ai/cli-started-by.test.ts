import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { lookupDefaultCliStartedByUserId, resolveCliStartedByUserId } from "./cli-started-by";

const ENV_KEY = "AI_CLI_STARTED_BY_USER_ID";

describe("resolveCliStartedByUserId", () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it("prefers --started-by over env", async () => {
    process.env[ENV_KEY] = "env-user";
    const id = await resolveCliStartedByUserId((flag) =>
      flag === "--started-by" ? "arg-user" : undefined,
    );
    assert.equal(id, "arg-user");
  });

  it("uses AI_CLI_STARTED_BY_USER_ID when flag is absent", async () => {
    process.env[ENV_KEY] = "env-user";
    const id = await resolveCliStartedByUserId(() => undefined);
    assert.equal(id, "env-user");
  });

  it("throws when nothing resolves", async () => {
    await assert.rejects(
      () => resolveCliStartedByUserId(() => undefined),
      /Could not determine audit user/,
    );
  });
});

describe("lookupDefaultCliStartedByUserId", () => {
  it("returns null when admin credentials are missing", async () => {
    const prevEmail = process.env.POCKETBASE_ADMIN_EMAIL;
    const prevPassword = process.env.POCKETBASE_ADMIN_PASSWORD;
    delete process.env.POCKETBASE_ADMIN_EMAIL;
    delete process.env.POCKETBASE_ADMIN_PASSWORD;

    try {
      await assert.doesNotReject(async () => {
        assert.equal(await lookupDefaultCliStartedByUserId(), null);
      });
    } finally {
      if (prevEmail !== undefined) {
        process.env.POCKETBASE_ADMIN_EMAIL = prevEmail;
      }
      if (prevPassword !== undefined) {
        process.env.POCKETBASE_ADMIN_PASSWORD = prevPassword;
      }
    }
  });
});
