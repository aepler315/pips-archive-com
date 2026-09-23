import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { readFile, mkdir } from "node:fs/promises";
import {
  base,
  date,
  key,
  record,
  fixture,
  launch,
  preview,
  seed,
  play,
  openResults,
  solveOnReload,
  storeCall,
} from "./helpers.mjs";
let stop;
before(async () => {
  stop = await preview();
});
after(async () => {
  await stop?.();
});
const engines = (process.env.PIPS_TEST_BROWSERS || "chromium,firefox,webkit").split(",");
for (const engine of engines) {
  test(`${engine}: production daily results`, { timeout: 240000 }, async (t) => {
    const browser = await launch(engine);
    t.after(() => browser.close());
    // One browser per engine; independent contexts avoid state leaking between scenarios.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "en-US",
    });
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await t.test(
      "legacy first times agree across play, stats, archive and the card; refresh is quiet",
      async () => {
        await seed(page, { easy: record(), medium: record(125000), hard: record(245000) });
        await play(page);
        await page.getByText("Recorded time: 02:00. Replays do not change it.").waitFor();
        assert.equal(await page.getByRole("dialog").count(), 0);
        await openResults(page);
        assert.equal(await page.locator(".results-score-easy strong").innerText(), "02:00");
        // Only today is seeded, so there is no other day to average against and
        // the column carries no comparison line at all.
        assert.equal(await page.locator(".results-score-easy .results-score-status").count(), 0);
        await page.keyboard.press("Escape");
        assert.match(await page.locator(":focus").getAttribute("aria-label"), /View results/);
        await page.reload();
        await page.locator(".results-date-trigger").waitFor();
        assert.equal(await page.getByRole("dialog").count(), 0);
        await page.goto(`${base}/stats`);
        await page.getByRole("columnheader", { name: "Recorded time", exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 6);
        const easy = page.locator("table").first().locator("tbody tr").filter({ hasText: "easy" });
        assert.match(await easy.innerText(), /02:00/);
        assert.doesNotMatch(await easy.innerText(), /01:00/);
        await page.goto(base);
        await page.locator("button").filter({ hasText: /19/ }).first().click();
        await page.getByRole("dialog").waitFor();
        assert.match(await page.getByRole("dialog").innerText(), /Solved in 02:00/);
      },
    );
    await t.test("history-based facts reach the card and preserve fixed metrics", async () => {
      await seed(page, { easy: record(60000), medium: record(62000), hard: record(30000) });
      await page.evaluate((value) => {
        for (let day = 14; day <= 18; day++)
          for (const level of ["easy", "medium", "hard"])
            localStorage.setItem(
              `pips-archive:v1:result:2026-09-${day}:${level}`,
              JSON.stringify(value),
            );
      }, record(120000));
      await play(page);
      await openResults(page);
      await page.getByText("Clean sweep", { exact: true }).waitFor();
      // The card prints each fact's label and value; the per-level breakdown
      // that used to follow ("Easy: 5 prior solves · …") was its explanation.
      assert.match(
        await page.locator(".results-facts").innerText(),
        /Clean sweep\nAll three quicker than usual/,
      );
      // Five prior days at 02:00 each; today's easy was 01:00, so the column
      // reports a full minute under the average of the days before it.
      assert.equal(
        await page.locator(".results-score-easy .results-score-status").innerText(),
        "−01:00 vs avg",
      );
      // Three rotating facts plus the winning-arrangement row that leads them.
      assert.equal(await page.locator(".results-fact").count(), 4);
      await page.keyboard.press("Escape");
    });
    await t.test(
      "all six completion orders celebrate once; practice cannot replace first",
      async () => {
        for (const order of [
          ["easy", "medium", "hard"],
          ["easy", "hard", "medium"],
          ["medium", "easy", "hard"],
          ["medium", "hard", "easy"],
          ["hard", "easy", "medium"],
          ["hard", "medium", "easy"],
        ]) {
          await seed(page, {});
          for (let i = 0; i < 3; i++) {
            await solveOnReload(page, order[i]);
            if (i < 2) assert.equal(await page.getByRole("dialog").count(), 0);
          }
          await page.getByRole("dialog").waitFor();
          assert.equal(await page.locator(".results-confetti i").count(), 14);
          const before = await page.evaluate((k) => localStorage.getItem(k), key(order[2]));
          await page.getByRole("button", { name: "Close", exact: true }).click();
          await solveOnReload(page, order[2]);
          await page.getByText(/Practice attempt/).waitFor();
          await page.waitForTimeout(550);
          assert.equal(await page.getByRole("dialog").count(), 0);
          assert.equal(await page.evaluate((k) => localStorage.getItem(k), key(order[2])), before);
        }
      },
    );
    await t.test(
      "partial and archived cards are honest; keyboard stays in dialog and clock pauses",
      async () => {
        await seed(page, { easy: record() }, "2026-09-18");
        await play(page, "easy", "2026-09-18");
        await openResults(page);
        assert.equal(await page.getByText("Not solved", { exact: true }).count(), 2);
        assert.ok(await page.getByRole("button", { name: "Share", exact: true }).isDisabled());
        assert.match(await page.locator(".results-date").innerText(), /09\/18\/2026/);
        const clock = await page.locator(".tabular-nums").first().innerText();
        await page.waitForTimeout(1100);
        assert.equal(await page.locator(".tabular-nums").first().innerText(), clock);
        for (let i = 0; i < 7; i++) {
          await page.keyboard.press("Tab");
          assert.ok(await page.locator(":focus").evaluate((e) => !!e.closest('[role="dialog"]')));
        }
        await page.keyboard.press("Control+z");
        assert.equal(await page.getByRole("dialog").count(), 1);
        await page.keyboard.press("Escape");
        assert.match(await page.locator(":focus").getAttribute("aria-label"), /View results/);
      },
    );
    await t.test("clipboard success and rejection both preserve the exact four lines", async () => {
      await seed(page, { easy: record(62000), medium: record(125000), hard: record(245000) });
      await play(page);
      await openResults(page);
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.copiedResults = text;
            },
          },
        }),
      );
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
      await page.getByText("Results copied to clipboard.").waitFor();
      const expected = "Pips 09/19/2026\nEasy: 01:02\nMedium: 02:05\nHard: 04:05\npipsarchive.com";
      assert.equal(await page.evaluate(() => window.copiedResults), expected);
      await page.evaluate(() =>
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () => {
              throw new Error("denied");
            },
          },
        }),
      );
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
      const fallback = page.getByRole("textbox", { name: "Results to copy" });
      await fallback.waitFor();
      assert.equal(await fallback.inputValue(), expected);
    });
    await t.test("responsive card exports the whole PNG with no controls or board", async () => {
      await mkdir(".superpowers/browser-artifacts", { recursive: true });
      await seed(page, { easy: record(62000), medium: record(125000), hard: record(245000) });
      for (const [width, height] of [
        [320, 568],
        [360, 640],
        [390, 844],
        [1280, 800],
        [667, 375],
      ]) {
        await page.setViewportSize({ width, height });
        await play(page);
        await openResults(page);
        const metrics = await page.locator(".daily-results-dialog").evaluate((el) => ({
          width: el.getBoundingClientRect().width,
          scroll: el.scrollWidth,
          client: el.clientWidth,
          bottom: el.getBoundingClientRect().bottom,
        }));
        assert.ok(metrics.width <= width - 31);
        assert.ok(metrics.scroll <= metrics.client + 1);
        assert.ok(metrics.bottom <= height);
        assert.ok(await page.getByRole("button", { name: "Close", exact: true }).isVisible());
        assert.equal(await page.locator(".daily-results-card button").count(), 0);
        // The analysis sidecar arrives after the dialog opens and adds the
        // summary line, so the card is still growing until it lands. Measuring
        // before then compares a stale height against the exported PNG.
        await page.locator(".results-summary").waitFor();
        const capture = await page.locator(".daily-results-card").evaluate((e) => ({
          width: e.getBoundingClientRect().width,
          height: e.getBoundingClientRect().height,
        }));
        const downloaded = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download PNG", exact: true }).click();
        const download = await downloaded;
        assert.equal(download.suggestedFilename(), "pips-2026-09-19.png");
        const path = `.superpowers/browser-artifacts/${engine}-${width}.png`;
        await download.saveAs(path);
        const png = await readFile(path);
        assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        assert.ok(Math.abs(png.readUInt32BE(16) - capture.width * 2) <= 2);
        assert.ok(Math.abs(png.readUInt32BE(20) - Math.ceil(capture.height) * 2) <= 2);
        await page.getByText("PNG ready", { exact: true }).waitFor();
        assert.equal(await page.locator(".results-export").count(), 0);
        await page.screenshot({
          path: `.superpowers/browser-artifacts/${engine}-${width}-screen.png`,
        });
        await page.keyboard.press("Escape");
      }
      await page.setViewportSize({ width: 320, height: 568 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await play(page);
      await openResults(page);
      await page.addStyleTag({ content: "html {font-size:24px}" });
      assert.ok(
        await page
          .locator(".daily-results-dialog")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 390, height: 844 });
    });
    await t.test(
      "failed third save freezes the attempt, retains progress, and retry celebrates",
      async () => {
        await seed(page, { easy: record(), medium: record() });
        await page.evaluate(
          ({ date, solution }) =>
            localStorage.setItem(
              `pips-archive:v1:progress:${date}:hard`,
              JSON.stringify({ state: solution.map((cells) => ({ cells })), elapsed: 12345 }),
            ),
          { date, solution: fixture.hard.solution },
        );
        const blocker = await page.addInitScript(() => {
          window.originalStorageSet = Storage.prototype.setItem;
          Storage.prototype.setItem = function (k, v) {
            if (k.includes(":result:")) throw new Error("quota");
            return window.originalStorageSet.call(this, k, v);
          };
        });
        void blocker;
        await play(page, "hard");
        await page.getByRole("button", { name: "Retry save" }).waitFor();
        assert.equal(await page.getByRole("dialog").count(), 0);
        const before = await page.locator('[role="status"] strong').innerText();
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('[role="status"] strong').innerText(), before);
        assert.ok(
          await page.evaluate(
            (date) => localStorage.getItem(`pips-archive:v1:progress:${date}:hard`),
            date,
          ),
        );
        await page.evaluate(() => {
          Storage.prototype.setItem = window.originalStorageSet;
        });
        await page.getByRole("button", { name: "Retry save" }).click();
        await page.getByRole("dialog").waitFor();
        assert.equal(await page.locator(".results-score-hard strong").innerText(), before);
        // Init scripts belong to this page: close it after this last UI scenario.
      },
    );
    assert.deepEqual(errors, []);
  });
  test(`${engine}: real cross-tab result races`, { timeout: 60000 }, async (t) => {
    const browser = await launch(engine);
    t.after(() => browser.close());
    const context = await browser.newContext();
    t.after(() => context.close());
    const a = await context.newPage(),
      b = await context.newPage();
    await seed(a, {});
    await b.goto(base);
    const writes = await Promise.all([
      storeCall(a, "recordSolve", [date, "easy", 120000]),
      storeCall(b, "recordSolve", [date, "easy", 60000]),
    ]);
    assert.deepEqual(writes.map((w) => w.status).sort(), ["created", "existing"]);
    const saved = await a.evaluate((k) => localStorage.getItem(k), key("easy"));
    const [, conflict] = await Promise.all([
      storeCall(a, "recordSolve", [date, "easy", 1]),
      storeCall(b, "importAll", [
        JSON.stringify({ version: 1, data: { [key("easy")]: record(1000) } }),
      ]),
    ]);
    assert.equal(conflict.unchanged, 1);
    assert.equal(conflict.skipped, 0);
    assert.equal(conflict.failed, 0);
    assert.equal(await a.evaluate((k) => localStorage.getItem(k), key("easy")), saved);
    const third = await Promise.all([
      storeCall(a, "recordSolve", [date, "medium", 100]),
      storeCall(b, "recordSolve", [date, "hard", 100]),
    ]);
    assert.equal(third.filter((w) => w.completedDay).length, 1);
    await play(b);
    assert.equal(await b.getByRole("dialog").count(), 0);
    await storeCall(a, "eraseAll", []);
    await b.locator(".results-date-trigger").waitFor({ state: "detached" });
    const imported = await storeCall(a, "importAll", [
      JSON.stringify({ version: 1, data: { [key("easy")]: record() } }),
    ]);
    assert.equal(imported.imported, 1);
    await b.locator(".results-date-trigger").waitFor();
    assert.equal(await b.getByRole("dialog").count(), 0);
  });
  test(
    `${engine}: asynchronous dialog lifecycle and recoverable image failures`,
    { timeout: 60000 },
    async (t) => {
      const browser = await launch(engine);
      t.after(() => browser.close());
      const context = await browser.newContext();
      t.after(() => context.close());
      const page = await context.newPage();
      await t.test("closing a manual reopen restores date focus after a fresh solve", async () => {
        await seed(page, { easy: record(), medium: record() });
        await solveOnReload(page, "hard");
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        await openResults(page);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(100);
        assert.match(
          (await page.locator(":focus").getAttribute("aria-label")) ?? "",
          /View results/,
        );
      });
      await t.test(
        "manual opening before the automatic delay does not reopen after dismissal",
        async () => {
          await seed(page, { easy: record(), medium: record() });
          await solveOnReload(page, "hard");
          await openResults(page);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(650);
          assert.equal(await page.getByRole("dialog").count(), 0);
        },
      );
      await t.test("PNG errors are recoverable and offscreen nodes are cleaned", async () => {
        await seed(page, { easy: record(), medium: record(), hard: record() });
        await play(page);
        await openResults(page);
        await page.evaluate(() => {
          window.canvasBlob = HTMLCanvasElement.prototype.toBlob;
          HTMLCanvasElement.prototype.toBlob = function (callback) {
            callback(null);
          };
        });
        await page.getByRole("button", { name: "Download PNG", exact: true }).click();
        await page.getByText("Couldn’t create the PNG. Please try again.").waitFor();
        assert.equal(await page.locator(".results-export").count(), 0);
        await page.evaluate(() => {
          HTMLCanvasElement.prototype.toBlob = window.canvasBlob;
        });
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download PNG", exact: true }).click();
        await download;
        await page.keyboard.press("Escape");
      });
      await t.test(
        "navigation during a locked save cannot open the old date's dialog",
        async () => {
          await seed(page, { easy: record(), medium: record() });
          const holder = await context.newPage();
          await holder.goto(base);
          await holder.evaluate(() => {
            window.lockHeld = false;
            navigator.locks.request(
              "pips-archive:results",
              () =>
                new Promise((resolve) => {
                  window.releaseResultLock = resolve;
                  window.lockHeld = true;
                }),
            );
          });
          await holder.waitForFunction(() => window.lockHeld);
          await page.evaluate(
            ({ date, solution }) =>
              localStorage.setItem(
                `pips-archive:v1:progress:${date}:hard`,
                JSON.stringify({ state: solution.map((cells) => ({ cells })), elapsed: 12345 }),
              ),
            { date, solution: fixture.hard.solution },
          );
          await play(page, "hard");
          await page.getByText("Saving recorded time…").waitFor();
          await page.getByRole("link", { name: /Easy/ }).click();
          await page.waitForURL("**/easy");
          await holder.evaluate(() => window.releaseResultLock());
          await page.waitForTimeout(650);
          assert.equal(await page.getByRole("dialog").count(), 0);
          assert.ok(await page.evaluate((k) => localStorage.getItem(k), key("hard")));
          await holder.close();
        },
      );
      await t.test(
        "hidden-page completion waits for visibility, across wall-clock midnight",
        async () => {
          const hidden = await context.newPage();
          await seed(hidden, { easy: record(), medium: record() });
          await hidden.addInitScript(() => {
            window.testHidden = true;
            Object.defineProperty(document, "hidden", {
              configurable: true,
              get: () => window.testHidden,
            });
          });
          await hidden.evaluate(
            ({ date, solution }) =>
              localStorage.setItem(
                `pips-archive:v1:progress:${date}:hard`,
                JSON.stringify({ state: solution.map((cells) => ({ cells })), elapsed: 12345 }),
              ),
            { date, solution: fixture.hard.solution },
          );
          await play(hidden, "hard");
          await hidden.locator(".results-date-trigger").waitFor();
          await hidden.waitForTimeout(550);
          assert.equal(await hidden.getByRole("dialog").count(), 0);
          await hidden.clock.setFixedTime(new Date("2026-09-20T00:01:00Z"));
          await hidden.evaluate(() => {
            window.testHidden = false;
            document.dispatchEvent(new Event("visibilitychange"));
          });
          await hidden.getByRole("dialog").waitFor();
          assert.match(await hidden.locator(".results-date").innerText(), /09\/19\/2026/);
          await hidden.close();
        },
      );
    },
  );
  test(
    `${engine}: erasing a hidden completed day cancels its queued celebration`,
    { timeout: 15000 },
    async (t) => {
      const browser = await launch(engine);
      t.after(() => browser.close());
      const context = await browser.newContext();
      t.after(() => context.close());
      const hidden = await context.newPage(),
        other = await context.newPage();
      await seed(hidden, { easy: record(), medium: record() });
      await other.goto(base);
      await hidden.addInitScript(() => {
        window.testHidden = true;
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => window.testHidden,
        });
      });
      await solveOnReload(hidden, "hard");
      await storeCall(other, "eraseAll", []);
      await hidden.locator(".results-date-trigger").waitFor({ state: "detached" });
      await hidden.evaluate(() => {
        window.testHidden = false;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await hidden.waitForTimeout(600);
      assert.equal(await hidden.getByRole("dialog").count(), 0);
      // An import completing the date later must not resurrect that cancelled event.
      await storeCall(other, "importAll", [
        JSON.stringify({
          version: 1,
          data: { [key("easy")]: record(), [key("medium")]: record(), [key("hard")]: record() },
        }),
      ]);
      await hidden.locator(".results-date-trigger").waitFor();
      await hidden.waitForTimeout(600);
      assert.equal(await hidden.getByRole("dialog").count(), 0);
    },
  );
}

for (const engine of engines) {
  test(`${engine}: analysis and performance snapshots at 320px`, { timeout: 60000 }, async (t) => {
    const browser = await launch(engine);
    t.after(() => browser.close());
    const context = await browser.newContext({
      viewport: { width: 320, height: 740 },
      reducedMotion: "reduce",
    });
    t.after(() => context.close());
    const page = await context.newPage();
    await seed(page, { easy: record(), medium: record(), hard: record() });
    await play(page);
    await openResults(page);
    await page.getByText("Easy: 3 · Medium: 1 · Hard: 2", { exact: true }).waitFor();
    assert.match(await page.locator(".results-facts").innerText(), /Easy: 3 · Medium: 1 · Hard: 2/);
    assert.equal(await page.locator(".results-facts .results-fact").count(), 4);
    assert.equal(await page.getByText("Structural challenge — experimental").count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mkdir("test-artifacts", { recursive: true });
    await page.screenshot({ path: `test-artifacts/${engine}-exact-analysis.png` });
    await page.keyboard.press("Escape");
    await page.route("**/data/analysis/*.json", async (route) => {
      const sidecar = JSON.parse(
        await readFile(new URL("../../data/analysis/2026-09-19.json", import.meta.url), "utf8"),
      );
      sidecar.analyses.easy.winning = { status: "bounded", lowerBound: "1", reason: "node-budget" };
      sidecar.analyses.easy.constraintInformationBits = null;
      await route.fulfill({ json: sidecar });
    });
    await seed(page, { easy: record() });
    await play(page);
    await openResults(page);
    await page.getByText(/At least 1 — count incomplete/).waitFor();
    assert.doesNotMatch(await page.locator(".results-facts").innerText(), /Medium: 1|Hard: 2/);
    await page.screenshot({ path: `test-artifacts/${engine}-incomplete-analysis.png` });
    await page.keyboard.press("Escape");
    await page.unroute("**/data/analysis/*.json");
    await page.route("**/data/analysis/*.json", (route) => route.fulfill({ status: 404 }));
    await play(page);
    await openResults(page);
    // A missing analysis sidecar still leaves the row in place, so the count
    // cannot quietly disappear from the card.
    await page.getByText("Unavailable", { exact: true }).waitFor();
    assert.equal(await page.locator(".results-fact").count(), 4);
    await page.keyboard.press("Escape");
    await page.goto(`${base}/stats`);
    await page.getByRole("region", { name: "Personal performance" }).waitFor();
    await page.getByText("1 / 10 calibration solves").waitFor();
    await page
      .getByRole("region", { name: "Personal performance" })
      .screenshot({ path: `test-artifacts/${engine}-calibration.png` });
    const data = {};
    for (let i = 1; i <= 20; i++)
      for (const level of ["easy", "medium", "hard"]) {
        const solvedAt = new Date(Date.UTC(2026, 0, i)).toISOString();
        data[key(level, `2020-01-${String(i).padStart(2, "0")}`)] = {
          first: i <= 10 ? 120000 : 60000,
          best: i <= 10 ? 120000 : 60000,
          plays: 1,
          solvedAt,
          lastAt: solvedAt,
        };
      }
    await storeCall(page, "eraseAll", []);
    await storeCall(page, "importAll", [JSON.stringify({ version: 1, data })]);
    await page.reload();
    await page.getByText("200.0 current form", { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page
      .getByRole("region", { name: "Personal performance" })
      .screenshot({ path: `test-artifacts/${engine}-performance.png` });
    const other = await context.newPage();
    await other.goto(`${base}/stats`);
    const backup = await storeCall(page, "exportAll", []);
    const before = JSON.parse(backup).analytics.baseline;
    await Promise.all([
      storeCall(page, "importAll", [backup]),
      storeCall(other, "recordSolve", ["2020-01-01", "easy", 1]),
    ]);
    assert.deepEqual(
      JSON.parse(await storeCall(other, "exportAll", [])).analytics.baseline,
      before,
    );
    await storeCall(page, "eraseAll", []);
    const nine = Object.fromEntries(
      Object.entries(data).filter(([k]) => k.endsWith(":easy") && Number(k.slice(-7, -5)) <= 9),
    );
    await storeCall(page, "importAll", [JSON.stringify({ version: 1, data: nine })]);
    await Promise.all([
      storeCall(page, "recordSolve", ["2020-01-10", "easy", 1000]),
      storeCall(other, "recordSolve", ["2020-01-11", "easy", 2000]),
    ]);
    const raced = JSON.parse(await storeCall(page, "exportAll", [])).analytics.baseline;
    assert.equal(raced.levels.easy.anchor.length, 10);
    assert.equal(
      raced.levels.easy.anchor.filter((r) => ["2020-01-10", "2020-01-11"].includes(r.date)).length,
      1,
    );
    await Promise.all([
      storeCall(page, "eraseAll", []),
      storeCall(other, "recordSolve", ["2020-01-21", "easy", 1000]),
    ]);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("pips-archive:v1:analytics")),
      null,
    );
  });
}
