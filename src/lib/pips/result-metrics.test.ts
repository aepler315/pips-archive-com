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
test("averages use first solves once per puzzle and exclude the card's own date", () => {
  assert.equal(typeof metrics.buildPersistentMetrics, "function");
  const history = [
    { ...r(60000), date: "2026-09-19", level: "easy" as const },
    { ...r(120000), date: "2026-09-18", level: "easy" as const },
    { ...r(40000), date: "2026-09-17", level: "easy" as const },
    { ...r(10), date: "2026-09-19", level: "easy" as const },
    { ...r(0), date: "2026-09-19", level: "medium" as const },
  ];
  const result = metrics.buildPersistentMetrics(day, history);
  assert.equal(result.easy.averageMs, 80000);
  assert.equal(result.easy.count, 2);
  // Today's easy solve was 60s against an 80s average on the other two days.
  assert.equal(result.easy.deltaMs, -20000);
  // Medium has today only, so there is nothing to compare against.
  assert.equal(result.medium.averageMs, null);
  assert.equal(result.medium.count, 0);
  assert.equal(result.medium.deltaMs, null);
  assert.equal(result.hard.averageMs, null);
  assert.equal(result.hard.deltaMs, null);
});
test("an unsolved level has no delta; corrupt history cannot skew averages", () => {
  const result = metrics.buildPersistentMetrics(
    buildDailyResults("2026-09-19", { easy: r(0), medium: null, hard: null }),
    [
      { ...r(NaN), date: "2026-09-18", level: "easy" },
      { ...r(1), date: "bad", level: "easy" },
      { ...r(30000), date: "2026-09-18", level: "medium" },
    ],
  );
  assert.equal(result.easy.count, 0);
  assert.equal(result.easy.deltaMs, null);
  // Medium has an average from history but no solve today, so no delta.
  assert.equal(result.medium.averageMs, 30000);
  assert.equal(result.medium.deltaMs, null);
});
