import assert from "node:assert/strict";
import { test } from "node:test";
import { groupMonths, resolveMonth } from "./months.ts";
import type { IndexEntry } from "./types.ts";

const stub = (date: string): IndexEntry => ({
  date,
  levels: {
    easy: { rows: 1, cols: 1, cells: 2, dominoes: 1 },
    medium: { rows: 1, cols: 1, cells: 2, dominoes: 1 },
    hard: { rows: 1, cols: 1, cells: 2, dominoes: 1 },
  },
});

test("groupMonths keeps newest-first pages of one month each", () => {
  const puzzles = [stub("2026-09-02"), stub("2026-09-01"), stub("2026-08-31")];
  const g = groupMonths(puzzles);
  assert.deepEqual(
    g.map((x) => x.month),
    ["2026-09", "2026-08"],
  );
  assert.equal(g[0].days.length, 2);
  assert.equal(g[1].days[0].date, "2026-08-31");
});

test("resolveMonth defaults to the latest page", () => {
  const g = groupMonths([stub("2026-09-01"), stub("2026-08-01")]);
  assert.equal(resolveMonth(g), "2026-09");
  assert.equal(resolveMonth(g, "2026-08"), "2026-08");
  assert.equal(resolveMonth(g, "1999-01"), "2026-09");
});
