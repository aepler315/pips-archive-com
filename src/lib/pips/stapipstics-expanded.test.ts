import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDailyResults } from "./daily-results";
import { evaluateStapipstics } from "./stapipstics-ranking";
import type { RawDay, RawPuzzle } from "./engine";
const r = (first: number) => ({ first, best: 1, plays: 20, solvedAt: "", lastAt: "" });
const summary = buildDailyResults("2026-09-19", {
  easy: r(60000),
  medium: r(62000),
  hard: r(30000),
});
const puzzle = (dominoes: RawPuzzle["dominoes"]): RawPuzzle => ({
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
});
const raw: RawDay = {
  printDate: summary.date,
  easy: puzzle([
    [0, 6],
    [1, 6],
    [2, 5],
    [3, 4],
  ]),
  medium: puzzle([
    [6, 0],
    [6, 1],
    [5, 2],
    [4, 3],
  ]),
  hard: puzzle([
    [0, 6],
    [3, 3],
    [3, 3],
    [3, 3],
  ]),
};
const facts = (history: Parameters<typeof evaluateStapipstics>[2] = []) =>
  new Map(evaluateStapipstics(summary, raw, history).map((e) => [e.id, e]));
test("expanded catalog includes all 22 options with auditable eligibility", () => {
  const evaluations = evaluateStapipstics(summary, raw);
  assert.equal(evaluations.length, 37);
  assert.equal(new Set(evaluations.map((e) => e.id)).size, 37);
  assert.equal(evaluations.filter((e) => e.selected).length, 3);
  for (const e of evaluations) assert.ok(Number.isFinite(e.score));
});
test("timing coincidences, reversals and piece overlap report exact evidence", () => {
  const f = facts();
  assert.match(f.get("photo")!.fact!.value, /00:02/);
  assert.match(f.get("plot")!.fact!.explanation, /Medium/);
  assert.match(f.get("shared")!.fact!.value, /1/);
  const differentTimes = buildDailyResults(summary.date, {
    easy: r(60000),
    medium: r(120000),
    hard: r(30000),
  });
  assert.match(
    evaluateStapipstics(differentTimes, raw).find((e) => e.id === "same-pieces")!.fact!.explanation,
    /4 shared distinct pairs out of 4/,
  );
  assert.match(f.get("double-take")!.fact!.value, /3 double-3/);
  assert.match(f.get("family")!.fact!.value, /Easy.*Medium/);
});
test("history excludes today's and later dates, deduplicates and ignores best times", () => {
  const history = Array.from({ length: 14 }, (_, i) => ({
    ...r(i < 7 ? 120000 : 180000),
    date: `2026-09-${String(18 - i).padStart(2, "0")}`,
    level: "easy" as const,
  }));
  history.push(
    { ...r(1), date: "2026-09-19", level: "easy" },
    { ...r(1), date: "2026-09-20", level: "easy" },
    { ...r(1), date: "2026-09-18", level: "easy" },
    { ...r(NaN), date: "bad", level: "easy" },
  );
  const f = facts(history);
  assert.match(f.get("usual")!.fact!.value, /60.0% quicker/);
  assert.match(f.get("usual")!.fact!.explanation, /14 prior/);
  assert.match(f.get("podium")!.fact!.value, /#1 of 15/);
  assert.match(f.get("moving")!.fact!.value, /33.3% quicker/);
  assert.equal(f.get("sweep")!.fact, null);
});
test("insufficient history, zero baselines and invalid puzzle data stay honest", () => {
  const zeroHistory = Array.from({ length: 5 }, (_, i) => ({
    ...r(0),
    date: `2026-09-${18 - i}`,
    level: "easy" as const,
  }));
  assert.equal(facts(zeroHistory).get("usual")!.fact, null);
  assert.equal(facts().get("moving")!.fact, null);
  const bad = evaluateStapipstics(summary, { ...raw, printDate: "2026-09-18" });
  for (const id of ["shared", "same-pieces", "family", "balanced", "squeeze"])
    assert.equal(bad.find((e) => e.id === id)!.fact, null);
  const partial = buildDailyResults(summary.date, { easy: r(0), medium: null, hard: null });
  for (const id of ["photo", "plot", "steady", "long-short", "majority"])
    assert.equal(evaluateStapipstics(partial, raw).find((e) => e.id === id)!.fact, null);
});

test("historical ties, clean sweeps, and trend thresholds are explicit", () => {
  const history = (["easy", "medium", "hard"] as const).flatMap((level) =>
    Array.from({ length: 5 }, (_, i) => ({ ...r(120000), date: `2026-09-${18 - i}`, level })),
  );
  const sweep = facts(history).get("sweep")!;
  assert.equal(sweep.fact!.value, "All three quicker than usual");
  assert.ok(sweep.selected);
  const tied = evaluateStapipstics(
    buildDailyResults(summary.date, { easy: r(120000), medium: null, hard: null }),
    raw,
    history,
  );
  assert.match(tied.find((e) => e.id === "podium")!.fact!.value, /Tied #1 of 6/);
  assert.equal(facts(history.slice(0, 4)).get("podium")!.fact, null);
});

test("time ratios and clustered times use nonzero denominators", () => {
  const tight = buildDailyResults(summary.date, {
    easy: r(60000),
    medium: r(60000),
    hard: r(62000),
  });
  const a = new Map(evaluateStapipstics(tight, raw).map((e) => [e.id, e]));
  assert.equal(a.get("photo")!.fact!.value, "An exact tie");
  assert.equal(a.get("steady")!.fact!.value, "00:02 from fastest to slowest");
  const uneven = buildDailyResults(summary.date, {
    easy: r(10000),
    medium: r(20000),
    hard: r(60000),
  });
  const b = new Map(evaluateStapipstics(uneven, raw).map((e) => [e.id, e]));
  assert.equal(b.get("long-short")!.fact!.value, "6.0× as long");
  assert.match(b.get("majority")!.fact!.explanation, /01:00 versus 00:30/);
  const zero = buildDailyResults(summary.date, { easy: r(0), medium: r(20000), hard: r(60000) });
  assert.equal(evaluateStapipstics(zero, raw).find((e) => e.id === "long-short")!.fact, null);
});

test("composition candidates count singleton pairs, extremes, totals and region sizes", () => {
  const p: RawDay = {
    printDate: summary.date,
    easy: {
      dominoes: [
        [1, 1],
        [1, 1],
      ],
      regions: [
        { type: "equals", indices: [[0, 0]] },
        {
          type: "empty",
          indices: [
            [0, 1],
            [1, 0],
            [1, 1],
          ],
        },
      ],
    },
    medium: puzzle([
      [0, 0],
      [0, 0],
    ]),
    hard: puzzle([
      [6, 6],
      [1, 6],
    ]),
  };
  const f = new Map(evaluateStapipstics(summary, p).map((e) => [e.id, e]));
  assert.equal(f.get("unique")!.fact!.value, "2 unique dominoes");
  assert.equal(f.get("opposites")!.fact!.value, "1 of 6 dominoes");
  assert.equal(f.get("seven")!.fact!.value, "1 of 6 dominoes");
  assert.match(f.get("small-mighty")!.fact!.value, /Hard holds 82.6%/);
  assert.match(f.get("exclusive")!.fact!.value, /Hard · 2/);
  assert.equal(f.get("room")!.fact!.value, "4 cells");
  assert.equal(f.get("tiny")!.fact!.value, "1 single-cell rule region");
  assert.equal(f.get("squeeze")!.fact!.explanation, "1 rule region / 4 cells");
  const balanced = {
    printDate: summary.date,
    easy: puzzle([[1, 1]]),
    medium: puzzle([[0, 2]]),
    hard: puzzle([[0, 0]]),
  };
  assert.equal(
    evaluateStapipstics(summary, balanced).find((e) => e.id === "balanced")!.fact!.value,
    "2 odd-side pips · 2 even-side pips",
  );
});

test("subsecond gaps and zero-time exact ties are described truthfully", () => {
  const tinyGap = buildDailyResults(summary.date, {
    easy: r(60000),
    medium: r(60500),
    hard: r(59000),
  });
  assert.match(
    evaluateStapipstics(tinyGap, raw).find((e) => e.id === "photo")!.fact!.value,
    /less than a second/,
  );
  const zero = buildDailyResults(summary.date, { easy: r(0), medium: r(0), hard: r(0) });
  const evaluations = evaluateStapipstics(zero, raw);
  assert.equal(evaluations.find((e) => e.id === "photo")!.fact!.value, "An exact tie");
  assert.equal(evaluations.find((e) => e.id === "long-short")!.fact, null);
  const nearly = {
    printDate: summary.date,
    easy: puzzle([
      [6, 5],
      [6, 5],
    ]),
    medium: puzzle([
      [6, 5],
      [6, 5],
    ]),
    hard: puzzle([[0, 3]]),
  };
  assert.equal(
    evaluateStapipstics(summary, nearly).find((e) => e.id === "balanced")!.fact!.label,
    "Nearly balanced",
  );
});
