import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function fixture(t, mode = "ok") {
  const root = mkdtempSync(join(tmpdir(), "pips-fetch-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["scripts", "js"])
    cpSync(new URL(`../${dir}`, import.meta.url), join(root, dir), { recursive: true });
  mkdirSync(join(root, "data/puzzles"), { recursive: true });
  const raw = JSON.parse(readFileSync(new URL("../data/puzzles/2026-09-15.json", import.meta.url)));
  writeFileSync(join(root, "data/puzzles/2026-09-15.json"), JSON.stringify(raw));
  writeFileSync(join(root, "package.json"), '{"type":"module"}');
  writeFileSync(
    join(root, "mock.mjs"),
    `
    import { appendFileSync, readFileSync } from 'node:fs';
    const RealDate = Date;
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : ['2026-09-17T12:00:00Z'])); }
      static now() { return new RealDate('2026-09-17T12:00:00Z').getTime(); }
    };
    const timers = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => timers(fn, 0);
    const attempts = new Map();
    globalThis.fetch = async (url, options) => {
      const date = String(url).match(/(\\d{4}-\\d{2}-\\d{2})\\.json$/)[1];
      appendFileSync('requests.txt', date + '\\n');
      const attempt = (attempts.get(date) ?? 0) + 1; attempts.set(date, attempt);
      if ((${JSON.stringify(mode)} === 'partial' && date === '2026-09-16') || ${JSON.stringify(mode)} === 'fail' || (${JSON.stringify(mode)} === 'retry' && attempt < 3)) return new Response(null, {status:503});
      if (${JSON.stringify(mode)} === 'signal' && !options.signal) throw Error('Missing request deadline');
      const raw = JSON.parse(readFileSync('data/puzzles/2026-09-15.json'));
      raw.printDate = date;
      return Response.json(raw);
    };
  `,
  );
  const run = (args = []) =>
    spawnSync(process.execPath, ["--import", "./mock.mjs", "scripts/fetch.mjs", ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, TZ: "UTC" },
    });
  const requests = () => {
    try {
      return readFileSync(join(root, "requests.txt"), "utf8").trim().split("\n");
    } catch {
      return [];
    }
  };
  return { root, run, requests };
}

test("default ingestion catches up every missing day through today", (t) => {
  const { root, run, requests } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(requests(), ["2026-09-16", "2026-09-17"]);
  assert.equal(JSON.parse(readFileSync(join(root, "data/index.json"))).last, "2026-09-17");
});
test("a temporary upstream failure retries and saves the puzzle", (t) => {
  const { root, run } = fixture(t, "retry");
  const result = run(["2026-09-17"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    JSON.parse(readFileSync(join(root, "data/puzzles/2026-09-17.json"))).printDate,
    "2026-09-17",
  );
});
test("failed multi-date requests return a failure exit code", (t) => {
  const { run } = fixture(t, "fail");
  assert.equal(run(["2026-09-16", "2026-09-17"]).status, 1);
});
test("all outbound puzzle requests have a deadline", (t) => {
  const { run } = fixture(t, "signal");
  const result = run(["2026-09-17"]);
  assert.equal(result.status, 0, result.stderr);
});
test("unchanged ingestion preserves both index files byte for byte", (t) => {
  const { root, run } = fixture(t);
  assert.equal(run(["2026-09-15"]).status, 0);
  const path = join(root, "data/index.json");
  const original = JSON.parse(readFileSync(path));
  original.generated = "2026-09-15T00:00:00.000Z";
  const before = JSON.stringify(original);
  writeFileSync(path, before);
  writeFileSync(join(root, "src/data/archive.json"), before);
  assert.equal(run(["2026-09-15"]).status, 0);
  assert.equal(readFileSync(path, "utf8"), before);
  assert.equal(readFileSync(join(root, "src/data/archive.json"), "utf8"), before);
});
test("invalid date arguments fail before any network or data changes", (t) => {
  const { run, requests } = fixture(t);
  for (const args of [
    ["2026-02-30"],
    ["2026-09-17; echo bad"],
    ["2026-09-17", "2026-09-16"],
    ["--unknown"],
  ]) {
    assert.equal(run(args).status, 1, JSON.stringify(args));
  }
  assert.deepEqual(requests(), []);
});

test('catch-up fills an internal gap even when a later date is already archived', (t) => {
  const { root, run, requests } = fixture(t);
  const raw = JSON.parse(readFileSync(join(root, 'data/puzzles/2026-09-15.json')));
  raw.printDate = '2026-09-17';
  writeFileSync(join(root, 'data/puzzles/2026-09-17.json'), JSON.stringify(raw));
  assert.equal(run().status, 0);
  assert.deepEqual(requests(), ['2026-09-16']);
});


test('partial failure preserves valid additions while returning a failure status', (t) => {
  const { root, run } = fixture(t, 'partial');
  const result = run(['2026-09-16', '2026-09-17']);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(readFileSync(join(root, 'data/puzzles/2026-09-17.json'))).printDate, '2026-09-17');
  assert.equal(JSON.parse(readFileSync(join(root, 'data/index.json'))).last, '2026-09-17');
});
