// @ts-check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Read PUBLIC_SITE_URL from repo root .env files (fallback when not in process.env). */
function readPublicSiteUrlFromDisk() {
  for (const name of [".env", ".env.local"]) {
    const full = path.join(repoRoot, name);
    try {
      const text = fs.readFileSync(full, "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        if (key !== "PUBLIC_SITE_URL") continue;
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return value;
      }
    } catch {
      // missing or unreadable file
    }
  }
  return undefined;
}

/**
 * Trust X-Forwarded-* from the reverse proxy so `Astro.url` matches the browser Origin
 * (Astro `security.checkOrigin` for multipart form POSTs).
 * @returns {Array<{ hostname: string; protocol: string; port?: string }>}
 */
function securityAllowedDomains() {
  const raw = process.env.PUBLIC_SITE_URL ?? readPublicSiteUrlFromDisk();
  /** @type {Array<{ hostname: string; protocol: string; port?: string }>} */
  const patterns = [];
  const seen = new Set();

  /** @param {{ hostname: string; protocol: string; port?: string }} pattern */
  const add = (pattern) => {
    const key = JSON.stringify(pattern);
    if (seen.has(key)) return;
    seen.add(key);
    patterns.push(pattern);
  };

  add({ hostname: "localhost", protocol: "http" });
  add({ hostname: "127.0.0.1", protocol: "http" });

  if (!raw) return patterns;

  try {
    const u = new URL(raw);
    /** @type {{ hostname: string; protocol: string; port?: string }} */
    const entry = { hostname: u.hostname, protocol: u.protocol.replace(":", "") };
    if (u.port) entry.port = u.port;
    add(entry);
  } catch {
    // ignore invalid PUBLIC_SITE_URL
  }

  return patterns;
}

export default defineConfig({
  output: "server",
  security: {
    allowedDomains: securityAllowedDomains(),
  },
  vite: {
    envDir: repoRoot,
    plugins: [tailwindcss()],
  },
  adapter: node({
    mode: "standalone",
  }),
});
