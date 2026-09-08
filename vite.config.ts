import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const LEVELS = ["easy", "medium", "hard"] as const;

// pipsarchive.com is a static site with no server: build a prerendered page
// list for every date/level so `npm run build` produces real HTML files at
// every playable URL, and GitHub Pages (or any static host) can serve them
// with no server-side routing.
function prerenderedPages() {
  const indexPath = fileURLToPath(new URL("./data/index.json", import.meta.url));
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as { puzzles: { date: string }[] };
  const pages = [{ path: "/" }, { path: "/stats" }];
  for (const { date } of index.puzzles) {
    for (const level of LEVELS) pages.push({ path: `/play/${date}/${level}` });
  }
  return pages;
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      prerender: { enabled: true, crawlLinks: false, retryCount: 0 },
      pages: prerenderedPages(),
    }),
    viteReact(),
  ],
});
