/**
 * Server-only environment reads for secrets and non-public config.
 *
 * Prefer `process.env` so Docker/Node can inject values at **container runtime** without baking
 * them into the Astro SSR bundle during `pnpm build` (see docker/Dockerfile.web).
 *
 * Falls back to `import.meta.env` for local `astro dev` / `vite` where vars are injected there.
 */
export function runtimeEnv(name: string): string | undefined {
  if (typeof process !== "undefined") {
    const fromProcess = process.env[name];
    if (typeof fromProcess === "string" && fromProcess.trim() !== "") {
      return fromProcess.trim();
    }
  }

  const meta =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      : undefined;
  const fromMeta = meta?.[name];
  if (typeof fromMeta === "string" && fromMeta.trim() !== "") {
    return fromMeta.trim();
  }

  return undefined;
}

export function requireRuntimeEnv(name: string): string {
  const value = runtimeEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
