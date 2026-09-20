import assert from "node:assert/strict";
import test from "node:test";
import { winningFact } from "./stapipstics-solutions";
import { evaluateStapipstics } from "./stapipstics-ranking";
import { buildDailyResults } from "./daily-results";
import sidecar from "../../../data/analysis/2026-09-19.json";
import raw from "../../../data/puzzles/2026-09-19.json";
import type { RawDay } from "./engine";
import type { PuzzleAnalysis } from "./puzzle-analysis-types";
const result = {
  first: 1000,
  best: 1000,
  plays: 1,
  solvedAt: "2026-09-19T00:00:00.000Z",
  lastAt: "2026-09-19T00:00:00.000Z",
};
const analysis = sidecar.analyses as Record<string, PuzzleAnalysis>;
test("counts are separate, incomplete is explicit and unsolved counts are hidden", () => {
  const summary = buildDailyResults(raw.printDate, { easy: result, medium: null, hard: null });
  const fact = winningFact(summary, analysis)!;
  assert.match(fact.value, /Easy: 3/);
  assert.doesNotMatch(fact.value, /Medium|Hard/);
  const selected = evaluateStapipstics(summary, raw as unknown as RawDay, []).filter(
    (e) => e.selected,
  );
  assert.equal(selected.length, 3);
  assert.equal(selected.some((e) => e.id === "solutions"), false);
  for (const lowerBound of ["0", "5"]) {
    const altered = {
      easy: {
        ...analysis.easy,
        winning: { status: "bounded" as const, lowerBound, reason: "node-budget" as const },
      },
    };
    const value = winningFact(summary, altered)!.value;
    assert.match(value, /[Cc]ount incomplete/);
    assert.equal(value.includes("At least 5"), lowerBound === "5");
    assert.doesNotMatch(value, /0 solutions/);
  }
  assert.equal(winningFact(summary, {}), null);
});
