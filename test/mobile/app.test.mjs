import assert from "node:assert/strict";
import { chromium } from "playwright";
import { test } from "node:test";
import { spawn } from "node:child_process";
test(
  "offline mobile routes, free-hint completion and persistent results",
  { timeout: 60_000 },
  async (t) => {
    const server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--config",
        "vite.mobile.config.ts",
        "--host",
        "127.0.0.1",
        "--port",
        "4181",
        "--strictPort",
      ],
      { stdio: "ignore" },
    );
    t.after(() => server.kill());
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error("Mobile preview stopped");
      try {
        if ((await fetch("http://127.0.0.1:4181/")).ok) break;
      } catch {
        /* wait for server */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const browser = await chromium.launch();
    t.after(() => browser.close());
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("**/*", (r) => {
      const url = new URL(r.request().url());
      if (url.host === "127.0.0.1:4181") return r.continue();
      external.push(url.href);
      return r.abort();
    });
    await page.goto("http://127.0.0.1:4181/play/2026-09-19/easy");
    await page.locator(".board-svg").waitFor();
    assert.equal(
      await page
        .locator("header")
        .first()
        .evaluate((node) => getComputedStyle(node).display),
      "flex",
      "Mobile build must include utilities from the shared source directory",
    );
    // Even an empty board retains a revealed hint and its active-play time.
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await page.getByRole("button", { name: "Nudge, Free", exact: true }).click();
    await page.reload();
    await page.locator(".board-svg").waitFor();
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await page.locator(".hint-tier-owned").waitFor({ timeout: 3000 });
    await page.keyboard.press("Escape");
    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: "Hint", exact: true }).click();
      await page
        .getByRole("button", { name: "Place a domino, Free", exact: true })
        .waitFor({ state: "visible" });
      await page.getByRole("button", { name: "Place a domino, Free", exact: true }).click();
      await page.getByRole("button", { name: "Place · Free", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
    await page.getByText("First solve recorded.", { exact: true }).waitFor();
    const record = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("pips-archive:v1:result:2026-09-19:easy")),
    );
    assert(record.first < 120000);
    assert.equal(record.assistance, undefined);
    await page.reload();
    await page.locator(".board-svg").waitFor();
    assert.match(await page.locator("body").innerText(), /Recorded time/);
    await page.goto("http://127.0.0.1:4181/stats");
    await page.getByRole("heading", { name: "Your solves", exact: true }).waitFor();
    assert.match(await page.locator("body").innerText(), /Your solves/);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);

    console.log(JSON.stringify({ status: "passed", record, errors, external }));
    await browser.close();
  },
);
