import { randomBytes } from "node:crypto";

/** 256 bits of entropy, URL-safe (spec §13.1). */
export function generateClarificationPublicToken(): string {
  return randomBytes(32).toString("base64url");
}
