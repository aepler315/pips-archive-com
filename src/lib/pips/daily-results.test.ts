import assert from "node:assert/strict";
import { test } from "node:test";
import * as daily from "./daily-results";
import type { Result } from "./store";

const r = (first: number): Result => ({
  first,
  best: first,
  plays: 1,
  solvedAt: "2026-09-19T00:00:00.000Z",
  lastAt: "2026-09-19T00:00:00.000Z",
});
test("summary is date-scoped, uses first, and distinguishes zero from missing", () => {
  assert.equal(typeof daily.buildDailyResults, "function");
  for (let count = 0; count <= 3; count++) {
    const summary = daily.buildDailyResults("2026-09-19", {
      easy: count > 0 ? r(0) : null,
      medium: count > 1 ? r(0) : null,
      hard: count > 2 ? r(0) : null,
    });
    assert.equal(summary.solvedCount, count);
    assert.equal(summary.complete, count === 3);
    assert.equal(summary.totalMs, count === 3 ? 0 : null);
    assert.equal(summary.records.hard === null, count < 3);
  }
  const summary = daily.buildDailyResults("2026-09-19", {
    easy: { ...r(120000), best: 60000 },
    medium: null,
    hard: null,
  });
  assert.equal(summary.records.easy?.first, 120000);
});
test("formatting pads minutes without wrapping at an hour", () => {
  for (const [ms, expected] of [
    [0, "00:00"],
    [999, "00:00"],
    [62000, "01:02"],
    [3600000, "60:00"],
    [6000000, "100:00"],
  ] as const)
    assert.equal(daily.formatResultDuration(ms), expected);
  assert.equal(daily.formatResultDate("2026-09-19"), "09/19/2026");
  for (const ms of [-1, NaN, Infinity]) assert.throws(() => daily.formatResultDuration(ms));
  for (const date of ["2026-02-30", "2026-9-19", "bad"])
    assert.throws(() => daily.formatResultDate(date));
});
