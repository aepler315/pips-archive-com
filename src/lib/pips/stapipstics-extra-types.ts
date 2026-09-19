import { formatResultDuration } from "./daily-results";
import type { Stapipstic } from "./stapipstics-candidates";
import type { Level } from "./engine";
import type { Result } from "./store";
export type ResultHistory = (Result & { date: string; level: Level })[];
export type ScoredFact = { id: string; fact: Stapipstic | null; score: number };
export const name = (level: Level) => level[0].toUpperCase() + level.slice(1);
export const mean = (values: number[]) =>
  values.reduce((avg, n, i) => avg + (n - avg) / (i + 1), 0);
export function collector(ids: string[]) {
  const facts: ScoredFact[] = ids.map((id) => ({ id, fact: null, score: 0 }));
  return {
    facts,
    add(
      id: string,
      group: Stapipstic["group"],
      label: string,
      value: string,
      explanation: string,
      score: number,
    ) {
      const entry = facts.find((f) => f.id === id)!;
      if (!Number.isFinite(score)) return;
      entry.fact = {
        id,
        group,
        family: group === "history" || group === "timing" ? "timing" : "composition",
        label,
        value,
        explanation,
      };
      entry.score = Math.max(0, Math.min(100, score));
    },
  };
}

export const gapText = (ms: number) =>
  ms > 0 && ms < 1000 ? "less than a second" : formatResultDuration(ms);
