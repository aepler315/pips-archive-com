import assert from "node:assert/strict";
import { test } from "node:test";
import * as stats from "./stapipstics";
import { buildDailyResults } from "./daily-results";
import type { RawDay, RawPuzzle } from "./engine";
const puzzle: RawPuzzle = {
  dominoes: [
    [0, 6],
    [3, 3],
  ],
  regions: [
    {
      type: "empty",
      indices: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
    },
  ],
};
const raw: RawDay = { printDate: "2026-09-19", easy: puzzle, medium: puzzle, hard: puzzle };
const result = (first: number) => ({
  first,
  best: 0,
  plays: 1,
  solvedAt: "2026-09-19T00:00:00Z",
  lastAt: "2026-09-19T00:00:00Z",
});
const summary = (a = 62000, b = 125000, c = 245000) =>
  buildDailyResults(raw.printDate, { easy: result(a), medium: result(b), hard: result(c) });
test("facts use hand-counted pips, halves, doubles and precise first-time arithmetic", () => {
  assert.equal(typeof stats.getStapipsticCandidates, "function");
  const facts = Object.fromEntries(
    stats.getStapipsticCandidates(summary(), raw).map((f) => [f.id, f.value]),
  );
  assert.equal(facts.payload, "36 pips");
  assert.equal(facts.doubles, "3 of 6 · 50.0%");
  assert.equal(facts.zeros, "3 of 12 · 25.0%");
  assert.equal(facts.sixes, "3 of 12 · 25.0%");
  assert.equal(facts.hard, "56.7%");
  assert.equal(facts.throughput, "5.0 pips/min");
  assert.equal(facts.gap, undefined);
  assert.equal(facts.comparison, undefined);
});
test("selection is deterministic with distinct subjects and puzzle composition", () => {
  const a = stats.getStapipstics(summary(), raw);
  assert.deepEqual(a, stats.getStapipstics(summary(), raw));
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((f) => f.id)).size, 3);
  assert.equal(new Set(a.map((f) => f.group)).size, 3);
  assert.ok(a.some((f) => f.family === "composition"));
});
test("zero denominators and partial days cannot invent timing facts", () => {
  const zero = stats.getStapipsticCandidates(summary(0, 0, 0), raw);
  assert.ok(!zero.some((f) => ["hard", "throughput"].includes(f.id)));

  const partial = buildDailyResults(raw.printDate, { easy: result(0), medium: null, hard: null });
  assert.ok(stats.getStapipstics(partial, raw).every((f) => f.family === "composition"));
  assert.ok(stats.getStapipstics(summary(NaN, 0, 0), raw).every((f) => f.family === "composition"));
});
test("empty and malformed composition omits unusable ratios", () => {
  const blank = { ...puzzle, dominoes: [] };
  const facts = stats.getStapipsticCandidates(summary(1, 1, 1), {
    ...raw,
    easy: blank,
    medium: blank,
    hard: blank,
  });
  assert.ok(!facts.some((f) => ["zeros", "sixes", "doubles"].includes(f.id)));

  const invalid = { ...puzzle, dominoes: [[NaN, 6]] as [number, number][] };
  assert.ok(
    !stats
      .getStapipsticCandidates(summary(), { ...raw, easy: invalid })
      .some((f) => f.family === "composition"),
  );
  const noPips = { ...puzzle, dominoes: [[0, 0]] as [number, number][] };
  assert.equal(
    stats
      .getStapipsticCandidates(summary(), { ...raw, easy: noPips, medium: noPips, hard: noPips })
      .find((f) => f.id === "doubles")!.value,
    "3 of 3 · 100.0%",
  );
});

test("expanded composition facts count pip frequency, missing faces and unordered repeats", () => {
  const facts = Object.fromEntries(
    stats.getStapipsticCandidates(summary(), raw).map((f) => [f.id, f]),
  );
  assert.equal(facts.common.value, "3");
  assert.equal(facts.common.explanation, "6 of 12 halves · 50.0% of the set.");
  assert.equal(facts.missing.value, "1, 2, 4, 5");
  assert.equal(facts.parity.value, "6 odd · 6 even");
  assert.equal(facts.repeats.value, "4 repeats");
  assert.equal(facts.repeats.explanation, "6 dominoes, 2 distinct pip pairs.");
  assert.equal(facts.pace.value, "72.0 sec/domino");
  assert.equal(facts.free.value, "12 of 12 cells");
  assert.equal(facts.throughput.explanation, "");
});
test("frequency ties, adjacent pairs, and rule mix are accurate", () => {
  const p: RawPuzzle = {
    dominoes: [
      [1, 2],
      [2, 1],
    ],
    regions: [
      {
        type: "equals",
        indices: [
          [0, 0],
          [0, 1],
        ],
      },
      {
        type: "sum",
        target: 3,
        indices: [
          [1, 0],
          [1, 1],
        ],
      },
    ],
  };
  const day = { ...raw, easy: p, medium: p, hard: p };
  const facts = Object.fromEntries(
    stats.getStapipsticCandidates(summary(), day).map((f) => [f.id, f]),
  );
  assert.equal(facts.common.value, "1 & 2");
  assert.match(facts.common.explanation, /Each appears on 6 of 12 halves/);
  assert.equal(facts.repeats.value, "5 repeats");
  assert.equal(facts.neighbors.value, "6 of 6 dominoes");
  assert.equal(facts.rules.value, "2 rule types");
  assert.equal(facts.rules.explanation, "3 sum · 3 equal.");
  assert.equal(facts.free, undefined);
});
test("fact groups prevent redundant selections across many dates and times", () => {
  const seen = new Set<string>();
  for (let n = 0; n < 50; n++) {
    const selected = stats.getStapipstics(summary(1000 + n * 700, 2300, 8100), raw);
    assert.equal(selected.length, 3);
    assert.equal(new Set(selected.map((f) => f.group)).size, 3);
    selected.forEach((f) => seen.add(f.id));
  }
  assert.ok(seen.size >= 8);
});
