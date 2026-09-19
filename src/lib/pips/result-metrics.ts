import { LEVELS, type Level } from "./engine";
import { buildDailyResults, validResultDate, type DayResults } from "./daily-results";
import type { Result } from "./store";

export type PersistentMetrics = Record<
  Level,
  { averageMs: number | null; count: number; sharePercent: number | null }
>;
export function buildPersistentMetrics(
  input: DayResults,
  history: (Result & { date: string; level: Level })[],
): PersistentMetrics {
  const summary = buildDailyResults(input.date, input.records);
  const metrics = Object.fromEntries(
    LEVELS.map((level) => [
      level,
      {
        averageMs: null,
        count: 0,
        sharePercent:
          summary.complete && summary.totalMs! > 0
            ? (summary.records[level]!.first / summary.totalMs!) * 100
            : null,
      },
    ]),
  ) as PersistentMetrics;
  const seen = new Set<string>();
  for (const result of history) {
    if (
      !LEVELS.includes(result.level) ||
      !validResultDate(result.date) ||
      !Number.isFinite(result.first) ||
      result.first < 0
    )
      continue;
    const key = `${result.date}:${result.level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const metric = metrics[result.level];
    metric.count++;
    metric.averageMs =
      (metric.averageMs ?? 0) + (result.first - (metric.averageMs ?? 0)) / metric.count;
  }
  return metrics;
}
