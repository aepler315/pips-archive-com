import assert from "node:assert/strict";
import test from "node:test";
import { approxCount, solutionSummary, WAYS_TO_FINISH_LABEL } from "./stapipstics-solutions";
import { buildDailyResults } from "./daily-results";
import type { CountResult, PuzzleAnalysis } from "./puzzle-analysis-types";
import type { Level } from "./engine";

const DATE = "2026-09-19";
const result = {
  first: 1000,
  best: 1000,
  plays: 1,
  solvedAt: "2026-09-19T00:00:00.000Z",
  lastAt: "2026-09-19T00:00:00.000Z",
};
const exact = (count: string): CountResult => ({ status: "exact", count });
const entry = (level: Level, winning: string, unconstrained: string): PuzzleAnalysis =>
  ({ date: DATE, level, winning: exact(winning), unconstrained: exact(unconstrained) }) as
    PuzzleAnalysis;
const allSolved = buildDailyResults(DATE, { easy: result, medium: result, hard: result });

test("counts that differ by an order of magnitude tell the spread story", () => {
  const summary = solutionSummary(allSolved, {
    easy: entry("easy", "1240", "5000"),
    medium: entry("medium", "60", "5000"),
    hard: entry("hard", "1", "5000"),
  });
  assert.equal(summary, "Easy had 1,240× as many ways to finish as Hard.");
});

test("counts that agree fall through to how far the rules narrowed the board", () => {
  const summary = solutionSummary(allSolved, {
    easy: entry("easy", "1", "3840"),
    medium: entry("medium", "1", "900000"),
    hard: entry("hard", "1", "2400"),
  });
  // Medium narrows hardest (900,000 down to one), so it is the one worth telling.
  assert.equal(summary, "Medium's rules ruled out all but one of 900,000 possible layouts.");
});

test("a tie with no usable unconstrained count still says something true", () => {
  const tie = (level: Level, winning: string): PuzzleAnalysis =>
    ({
      date: DATE,
      level,
      winning: exact(winning),
      unconstrained: { status: "bounded", lowerBound: "10", reason: "node-budget" },
    }) as PuzzleAnalysis;
  assert.equal(
    solutionSummary(allSolved, {
      easy: tie("easy", "4"),
      medium: tie("medium", "4"),
      hard: tie("hard", "4"),
    }),
    "Every board had exactly 4 ways to finish.",
  );
  assert.equal(
    solutionSummary(allSolved, { easy: tie("easy", "1"), medium: tie("medium", "1") }),
    "Every board had exactly one way to finish.",
  );
});

test("a near-tie prefers narrowing, and states a fractional multiple without it", () => {
  assert.equal(
    solutionSummary(allSolved, {
      easy: entry("easy", "7", "70"),
      medium: entry("medium", "2", "70"),
    }),
    "Medium's rules ruled out all but 2 of 70 possible layouts.",
  );
  const bounded = (level: Level, winning: string): PuzzleAnalysis =>
    ({
      date: DATE,
      level,
      winning: exact(winning),
      unconstrained: { status: "invalid", reason: "budget" },
    }) as PuzzleAnalysis;
  assert.equal(
    solutionSummary(allSolved, { easy: bounded("easy", "7"), medium: bounded("medium", "2") }),
    "Easy had 3.5× as many ways to finish as Medium.",
  );
});

test("unsolved, mismatched and uncounted levels are left out", () => {
  const partial = buildDailyResults(DATE, { easy: result, medium: null, hard: null });
  // Medium is not solved, so its far larger count cannot drive the sentence.
  assert.equal(
    solutionSummary(partial, {
      easy: entry("easy", "2", "80"),
      medium: entry("medium", "9999", "80"),
    }),
    "Easy's rules ruled out all but 2 of 80 possible layouts.",
  );
  // A sidecar for another date is ignored outright.
  assert.equal(
    solutionSummary(partial, { easy: { ...entry("easy", "2", "80"), date: "2026-09-18" } }),
    null,
  );
  assert.equal(solutionSummary(partial, {}), null);
  // One level with nothing to compare and no narrowing leaves no sentence.
  assert.equal(
    solutionSummary(partial, {
      easy: { ...entry("easy", "2", "80"), unconstrained: { status: "invalid", reason: "x" } },
    }),
    null,
  );
});

test("big counts round to scale words and very big ones to exponents", () => {
  assert.equal(approxCount(0n), "0");
  assert.equal(approxCount(3840n), "3,840");
  assert.equal(approxCount(999_999n), "999,999");
  assert.equal(approxCount(1_000_000n), "1 million");
  assert.equal(approxCount(2_412_883_904n), "2.4 billion");
  assert.equal(approxCount(10n ** 15n), "1 quadrillion");
  assert.equal(approxCount(10n ** 21n * 12n), "1.2 × 10^22");
});

test("the row label is the plain-English one the card renders", () => {
  assert.equal(WAYS_TO_FINISH_LABEL, "Ways to finish");
});
