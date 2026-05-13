// @ts-check
import node from "@astrojs/node";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "server",
  vite: {
    envDir: fileURLToPath(new URL("../..", import.meta.url)),
    plugins: [tailwindcss()],
  },
  adapter: node({
    mode: "standalone",
  }),
});
