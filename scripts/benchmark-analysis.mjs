import { readFileSync, writeFileSync } from "node:fs";
import { hashPuzzle, countWinningArrangements } from "../src/lib/pips/solution-count.ts";
import { profilePuzzle } from "../src/lib/pips/puzzle-complexity.ts";
import { countUnconstrainedArrangements } from "../src/lib/pips/solution-space.ts";
const referencePath = "data/analysis/reference-v1.json";
const reference = JSON.parse(readFileSync(referencePath, "utf8"));
const selected = [...new Set(reference.corpus.map((row) => `${row.date}.json`))].sort();
const limits = { nodeBudget: 50000, memoEntryBudget: 25000, deadlineMs: 3000 };
const rows = [];
const started = performance.now();
for (const file of selected) {
  const raw = JSON.parse(readFileSync(`data/puzzles/${file}`, "utf8"));
  for (const level of ["easy", "medium", "hard"]) {
    const start = performance.now();
    const puzzleHash = await hashPuzzle(raw[level]);
    const winning = countWinningArrangements(raw[level], limits);
    const unconstrained = countUnconstrainedArrangements(raw[level], limits);
    const structural = await profilePuzzle(raw[level], limits);
    rows.push({
      date: file.slice(0, 10),
      level,
      puzzleHash,
      winning,
      unconstrained,
      structural,
      elapsedMs: Math.round(performance.now() - start),
    });
  }
  console.log(`${file}: ${rows.length}/90`);
}
for (const row of rows) {
  const expected = reference.corpus.find((r) => r.date === row.date && r.level === row.level);
  if (!expected || expected.puzzleHash !== row.puzzleHash)
    throw new Error(
      `Frozen reference content changed: ${row.date}/${row.level}. Create a new explicitly versioned reference.`,
    );
}
const report = {
  countingVersion: "winning-arrangements-v1",
  solverVersion: "first-solution-v1",
  limits,
  runtimeMs: Math.round(performance.now() - started),
  maxRssKb: process.resourceUsage().maxRSS,
  winningCoverage: Object.fromEntries(
    ["exact", "bounded", "invalid"].map((s) => [
      s,
      rows.filter((r) => r.winning.status === s).length,
    ]),
  ),
  structuralCoverage: {
    total: rows.length,
    complete: rows.filter((r) => r.structural.status === "complete").length,
  },
  worst: [...rows]
    .sort((a, b) => b.elapsedMs - a.elapsedMs)
    .slice(0, 5)
    .map(({ date, level, elapsedMs, winning }) => ({ date, level, elapsedMs, winning })),
  rows,
};
writeFileSync("data/analysis/benchmark-v1.json", JSON.stringify(report) + "\n");
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
