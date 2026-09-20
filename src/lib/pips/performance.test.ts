import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveLevelBaseline,
  scoreFirstResult,
  summarizeCurrentForm,
  validateBaseline,
} from "./performance";
import { LEVELS, type Level } from "./engine";
const records = (count = 20, level: Level = "easy") =>
  Array.from({ length: count }, (_, i) => ({
    date: `2020-01-${String(i + 1).padStart(2, "0")}`,
    level,
    first: i < 10 ? 120000 : 60000,
    solvedAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
  }));
test("ten chronological immutable anchors define geometric baseline, post-anchor scores double", () => {
  assert.equal(deriveLevelBaseline(records(9)), null);
  const anchor = deriveLevelBaseline(records())!;
  assert.equal(anchor.anchor.length, 10);
  assert.ok(Math.abs(scoreFirstResult(records()[10], anchor)!.score - 200) < 1e-9);
  assert.equal(scoreFirstResult(records()[0], anchor), null);
  assert.equal(scoreFirstResult({ ...records()[10], first: 0 }, anchor), null);
  assert.deepEqual(
    deriveLevelBaseline(
      [...records(), { ...records()[0], date: "1999-01-01", solvedAt: "2000-01-01T00:00:00.000Z" }],
      anchor,
    ),
    anchor,
  );
});
test("balanced form uses three level windows and actual completion time, no future leakage", () => {
  const all = LEVELS.flatMap((l) => records(20, l));
  const baseline = {
    schemaVersion: 1 as const,
    modelVersion: "level-anchor-v1" as const,
    levels: Object.fromEntries(LEVELS.map((l) => [l, deriveLevelBaseline(records(20, l))!])),
  };
  const form = summarizeCurrentForm(all, baseline);
  assert.equal(form.status, "complete");
  assert.ok(Math.abs(form.score! - 200) < 1e-9);
  assert.equal(summarizeCurrentForm(records(), baseline).score, null);
  const earlier = summarizeCurrentForm(all, baseline, "2026-01-12T23:59:59.000Z");
  assert.equal(earlier.score, null);
  assert.equal(earlier.levels.easy.count, 2);
  assert.equal(
    summarizeCurrentForm(all, baseline, "2026-01-13T23:59:59.000Z").status,
    "provisional",
  );
  assert.ok(validateBaseline(baseline, all));
  assert.equal(
    validateBaseline(
      { ...baseline, levels: { easy: { ...baseline.levels.easy, logExpectedMs: 999 } } },
      all,
    ),
    null,
  );
  const speed = records(12);
  speed[11].first = 240000;
  const cancel = summarizeCurrentForm(speed, baseline).levels.easy;
  assert.ok(Math.abs(cancel.score! - 100) < 1e-9);
});

test("timeline windows match as-of form without including future completions", async () => {
  const { buildPerformanceTimeline } = await import("./performance");
  const all = LEVELS.flatMap((l) => records(20, l));
  const baseline = {
    schemaVersion: 1 as const,
    modelVersion: "level-anchor-v1" as const,
    levels: Object.fromEntries(LEVELS.map((l) => [l, deriveLevelBaseline(records(20, l))!])),
  };
  for (const point of buildPerformanceTimeline(all, baseline)) {
    const expected = summarizeCurrentForm(all, baseline, new Date(point.completed).toISOString());
    for (const l of LEVELS) assert.equal(point[l], expected.levels[l].score);
  }
});
