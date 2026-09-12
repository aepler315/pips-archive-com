import assert from "node:assert/strict";
import { test } from "node:test";
import { pickRandomUnsolved, resultKeyOf } from "./random.ts";
import type { IndexEntry } from "./types.ts";

const stub = (date: string): IndexEntry => ({
  date,
  levels: {
    easy: { rows: 1, cols: 1, cells: 2, dominoes: 1 },
    medium: { rows: 1, cols: 1, cells: 2, dominoes: 1 },
    hard: { rows: 1, cols: 1, cells: 2, dominoes: 1 },
  },
});

test("pickRandomUnsolved returns null when every level is solved", () => {
  const puzzles = [stub("2026-09-01")];
  const results = new Map([
    [resultKeyOf("2026-09-01", "easy"), {}],
    [resultKeyOf("2026-09-01", "medium"), {}],
    [resultKeyOf("2026-09-01", "hard"), {}],
  ]);
  assert.equal(pickRandomUnsolved(puzzles, results), null);
});

test("pickRandomUnsolved skips a solved level and the excluded current puzzle", () => {
  const puzzles = [stub("2026-09-01")];
  const results = new Map([[resultKeyOf("2026-09-01", "easy"), {}]]);
  const pick = pickRandomUnsolved(puzzles, results, { date: "2026-09-01", level: "medium" });
  assert.deepEqual(pick, ["2026-09-01", "hard"]);
});

test("pickRandomUnsolved returns null when the only open level is excluded", () => {
  const puzzles = [stub("2026-09-01")];
  const results = new Map([
    [resultKeyOf("2026-09-01", "easy"), {}],
    [resultKeyOf("2026-09-01", "medium"), {}],
  ]);
  assert.equal(
    pickRandomUnsolved(puzzles, results, { date: "2026-09-01", level: "hard" }),
    null,
  );
});
