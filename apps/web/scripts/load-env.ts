/**
 * Load repo-root `.env` / `.env.local` into `process.env` for `tsx` CLI scripts.
 * Astro dev injects these via Vite; standalone scripts do not.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const eq = trimmed.indexOf("=");
  if (eq === -1) {
    return null;
  }
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

/**
 * Load env files into `process.env`.
 * @param override When true (CLI default), values from disk replace existing shell env for those keys.
 */
export function loadRepoEnv(override = true): void {
  // Base first, then local overrides — same precedence as Vite/Astro.
  for (const name of [".env", ".env.local"]) {
    const filePath = path.join(repoRoot, name);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split("\n")) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }
      const existing = process.env[parsed.key];
      if (override || existing === undefined || existing === "") {
        process.env[parsed.key] = parsed.value;
      }
    }
  }
}

loadRepoEnv();
