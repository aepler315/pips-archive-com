import assert from "node:assert/strict";
import { test } from "node:test";
import * as ranking from "./stapipstics-ranking";
import { buildDailyResults } from "./daily-results";
import type { RawPuzzle, RawDay } from "./engine";
const r = (first: number) => ({
  first,
  best: first,
  plays: 1,
  solvedAt: "2026-09-19T00:00:00Z",
  lastAt: "2026-09-19T00:00:00Z",
});
const summary = buildDailyResults("2026-09-19", { easy: r(1000), medium: r(2000), hard: r(3000) });
const day = (dominoes: RawPuzzle["dominoes"]): RawDay => {
  const p: RawPuzzle = {
    dominoes,
    regions: [
      {
        type: "empty",
        indices: dominoes.flatMap((_, i) => [
          [i, 0],
          [i, 1],
        ]),
      },
    ],
  };
  return { printDate: summary.date, easy: p, medium: p, hard: p };
};
test("evaluates every registered fact with result, score, and selection reason", () => {
  assert.equal(typeof ranking.evaluateStapipstics, "function");
  const evaluations = ranking.evaluateStapipstics(
    summary,
    day([
      [0, 0],
      [0, 0],
    ]),
  );
  assert.equal(evaluations.length, 15);
  assert.equal(new Set(evaluations.map((e) => e.id)).size, 15);
  assert.ok(evaluations.every((e) => Number.isFinite(e.score) && e.reason.length > 0));
  const hard = evaluations.find((e) => e.id === "hard")!;
  assert.ok(hard.fact);
  assert.equal(hard.selected, false);
  assert.equal(hard.reason, "already-shown");
  const selected = evaluations.filter((e) => e.selected);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((e) => e.fact!.group)).size, 3);
  assert.deepEqual(
    evaluations,
    ranking.evaluateStapipstics(
      summary,
      day([
        [0, 0],
        [0, 0],
      ]),
    ),
  );
});
test("actual outputs affect scores and selection, rather than a date lottery", () => {
  const allBlanks = ranking.evaluateStapipstics(
    summary,
    day([
      [0, 0],
      [0, 0],
    ]),
  );
  const varied = ranking.evaluateStapipstics(
    summary,
    day([
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 0],
    ]),
  );
  assert.ok(
    allBlanks.find((e) => e.id === "zeros")!.score > varied.find((e) => e.id === "zeros")!.score,
  );
  assert.ok(allBlanks.find((e) => e.id === "zeros")!.selected);
  assert.notDeepEqual(
    allBlanks.filter((e) => e.selected).map((e) => e.id),
    varied.filter((e) => e.selected).map((e) => e.id),
  );
});
test("partial and zero-time days reject rates; empty data cannot supply invented facts", () => {
  const partial = buildDailyResults(summary.date, { easy: r(0), medium: null, hard: null });
  const evaluations = ranking.evaluateStapipstics(partial, day([]));
  for (const id of ["pace", "throughput", "common"]) {
    const e = evaluations.find((e) => e.id === id)!;
    assert.equal(e.selected, false);
    assert.equal(e.fact, null);
    assert.equal(e.reason, "insufficient-data");
  }
});
