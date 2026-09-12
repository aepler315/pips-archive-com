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
  const start = Math.floor(Math.random() * puzzles.length);
  for (let i = 0; i < puzzles.length; i++) {
    const p = puzzles[(start + i) % puzzles.length];
    const open = LEVELS.filter((l) => {
      if (exclude && p.date === exclude.date && l === exclude.level) return false;
      return !results.has(resultKeyOf(p.date, l));
    });
    if (open.length) return [p.date, open[Math.floor(Math.random() * open.length)]];
  }
  return null;
}
