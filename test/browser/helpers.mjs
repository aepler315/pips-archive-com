import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";
import { chromium, firefox, webkit } from "playwright";

export const base = process.env.PIPS_TEST_URL || "http://127.0.0.1:4173";
export const date = "2026-09-19";
export const key = (level, day = date) => `pips-archive:v1:result:${day}:${level}`;
export const record = (first = 120000) => ({
  first,
  best: Math.min(first, 60000),
  plays: 2,
  solvedAt: "2026-09-19T00:00:00.000Z",
  lastAt: "2026-09-19T01:00:00.000Z",
});
export const fixture = await readFile(
  new URL("../../data/puzzles/2026-09-19.json", import.meta.url),
  "utf8",
).then(JSON.parse);
export async function preview() {
  // Test-only entry bundles the real storage implementation; never shipped with the app.
  const outDir = resolve("dist/client/__results_test__");
  await mkdir(outDir, { recursive: true });
  await build({
    configFile: false,
    logLevel: "error",
    build: {
      outDir,
      emptyOutDir: true,
      lib: { entry: resolve("src/lib/pips/store.ts"), formats: ["es"], fileName: () => "store.js" },
    },
  });
  if (process.env.PIPS_TEST_URL)
    return async () => {
      await rm(outDir, { recursive: true, force: true });
    };
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
      "--strictPort",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let log = "";
  server.stdout.on("data", (d) => {
    log += d;
  });
  server.stderr.on("data", (d) => {
    log += d;
  });
  try {
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(`Preview stopped: ${log}`);
      try {
        if ((await fetch(base)).ok)
          return async () => {
            server.kill();
            await rm(outDir, { recursive: true, force: true });
          };
      } catch {
        /* wait for listening */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`Preview did not start: ${log}`);
  } catch (error) {
    server.kill();
    await rm(outDir, { recursive: true, force: true });
    throw error;
  }
}
export async function launch(name) {
  const override = name === "chromium" && process.env.PIPS_CHROMIUM_PATH;
  return { chromium, firefox, webkit }[name].launch(
    override
      ? {
          executablePath: override,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--no-zygote",
            "--single-process",
            "--use-gl=angle",
            "--use-angle=swiftshader",
          ],
        }
      : {},
  );
}
export async function seed(page, records, day = date) {
  await page.goto(base);
  await page.evaluate(
    ({ records, day }) => {
      localStorage.clear();
      for (const [level, value] of Object.entries(records))
        localStorage.setItem(`pips-archive:v1:result:${day}:${level}`, JSON.stringify(value));
    },
    { records, day },
  );
}
export async function play(page, level = "easy", day = date) {
  await page.goto(`${base}/play/${day}/${level}`);
  await page.waitForFunction(() => document.querySelector(".board-svg"));
}
export async function openResults(page) {
  await page.locator(".results-date-trigger").click();
  await page.getByRole("dialog").waitFor();
}
export async function solveOnReload(page, level, day = date) {
  const raw =
    day === date
      ? fixture
      : await readFile(new URL(`../../data/puzzles/${day}.json`, import.meta.url), "utf8").then(
          JSON.parse,
        );
  await page.evaluate(
    ({ level, day, solution }) => {
      localStorage.setItem(
        `pips-archive:v1:progress:${day}:${level}`,
        JSON.stringify({ state: solution.map((cells) => ({ cells })), elapsed: 12345 }),
      );
    },
    { level, day, solution: raw[level].solution },
  );
  await play(page, level, day);
  await page.locator(".results-date-trigger").waitFor();
}
export async function storeCall(page, method, args) {
  return page.evaluate(
    async ({ method, args }) => (await import("/__results_test__/store.js"))[method](...args),
    { method, args },
  );
}
