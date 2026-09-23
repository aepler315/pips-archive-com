import { LEVELS, type Level } from "./engine";
import { allResults } from "./store";
import type { IndexEntry } from "./types";

export type ResultKey = `${string}:${Level}`;

export const resultKeyOf = (date: string, level: Level): ResultKey => `${date}:${level}`;

export function resultsMapFromStorage() {
  return new Map(allResults().map((r) => [resultKeyOf(r.date, r.level), r]));
}

export function pickRandomUnsolved(
  puzzles: IndexEntry[],
  results: Map<string, unknown>,
  exclude?: { date: string; level: Level },
): [string, Level] | null {
  if (!puzzles.length) return null;
  // Stay on easy until every easy is done, then medium, then hard.
  // A day whose current tier is already solved is not a candidate.
  for (const level of LEVELS) {
    const open = puzzles.filter((p) => {
      if (exclude && p.date === exclude.date && level === exclude.level) return false;
      return !results.has(resultKeyOf(p.date, level));
    });
    if (!open.length) continue;
    return [open[Math.floor(Math.random() * open.length)].date, level];
  }
  return null;
}
