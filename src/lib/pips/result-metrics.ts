import { scoredFirstMs } from "./hints";
import { LEVELS, type Level } from "./engine";
import { buildDailyResults, validResultDate, type DayResults } from "./daily-results";
import type { Result } from "./store";

export type PersistentMetrics = Record<
  Level,
  { averageMs: number | null; count: number; deltaMs: number | null }
>;
/** Averages deliberately exclude the card's own date: "vs avg" compares today
 *  against the other days you have played, not against a mean it sits inside. */
export function buildPersistentMetrics(
  input: DayResults,
  history: (Result & { date: string; level: Level })[],
): PersistentMetrics {
  const summary = buildDailyResults(input.date, input.records);
  const metrics = Object.fromEntries(
    LEVELS.map((level) => [level, { averageMs: null, count: 0, deltaMs: null }]),
  ) as PersistentMetrics;
  const seen = new Set<string>();
  for (const result of history) {
    if (
      !LEVELS.includes(result.level) ||
      !validResultDate(result.date) ||
      result.date === summary.date ||
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
      (metric.averageMs ?? 0) + (scoredFirstMs(result) - (metric.averageMs ?? 0)) / metric.count;
  }
  for (const level of LEVELS) {
    const metric = metrics[level];
    const today = summary.records[level];
    if (today && metric.averageMs !== null)
      metric.deltaMs = scoredFirstMs(today) - metric.averageMs;
  }
  return metrics;
}
