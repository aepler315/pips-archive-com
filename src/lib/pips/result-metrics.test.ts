import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDailyResults } from "./daily-results";
import * as metrics from "./result-metrics";
const r = (first: number) => ({
  first,
  best: 0,
  plays: 20,
  solvedAt: "2026-09-19T00:00:00Z",
  lastAt: "2026-09-19T00:00:00Z",
});
const day = buildDailyResults("2026-09-19", { easy: r(60000), medium: r(120000), hard: r(180000) });
test("fixed metrics use first solves once per puzzle and exact daily time shares", () => {
  assert.equal(typeof metrics.buildPersistentMetrics, "function");
  const history = [
    { ...r(60000), date: "2026-09-19", level: "easy" as const },
    { ...r(120000), date: "2026-09-18", level: "easy" as const },
    { ...r(10), date: "2026-09-19", level: "easy" as const },
    { ...r(0), date: "2026-09-19", level: "medium" as const },
  ];
  const result = metrics.buildPersistentMetrics(day, history);
  assert.equal(result.easy.averageMs, 90000);
  assert.equal(result.easy.count, 2);
  assert.equal(result.medium.averageMs, 0);
  assert.equal(result.medium.count, 1);
  assert.equal(result.hard.averageMs, null);
  assert.ok(Math.abs(result.easy.sharePercent! - 100 / 6) < 1e-10);
  assert.equal(result.hard.sharePercent, 50);
});
test("missing or zero totals remain undefined; corrupt history cannot skew averages", () => {
  const result = metrics.buildPersistentMetrics(
    buildDailyResults("2026-09-19", { easy: r(0), medium: null, hard: null }),
    [
      { ...r(NaN), date: "2026-09-18", level: "easy" },
      { ...r(1), date: "bad", level: "easy" },
    ],
  );
  assert.equal(result.easy.count, 0);
  assert.equal(result.easy.sharePercent, null);
  const zero = metrics.buildPersistentMetrics(
    buildDailyResults("2026-09-19", { easy: r(0), medium: r(0), hard: r(0) }),
    [],
  );
  assert.equal(zero.hard.sharePercent, null);
});
