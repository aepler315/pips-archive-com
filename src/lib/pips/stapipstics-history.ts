import { scoredFirstMs } from "./hints";
import { LEVELS } from "./engine";
import { validResultDate, type DayResults } from "./daily-results";
import { collector, mean, name, type ResultHistory } from "./stapipstics-extra-types";

// Five prior puzzles for personal comparisons; two complete seven-solve windows
// for trends. Puzzle dates, rather than replay timestamps, define the baseline.
export function historyFacts(summary: DayResults, history: ResultHistory) {
  const { facts, add } = collector(["usual", "podium", "sweep", "moving"]);
  const seen = new Set<string>();
  const prior = history
    .filter((r) => {
      const key = `${r.date}:${r.level}`;
      if (
        !LEVELS.includes(r.level) ||
        !validResultDate(r.date) ||
        r.date >= summary.date ||
        !Number.isFinite(r.first) ||
        r.first < 0 ||
        seen.has(key)
      )
        return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const levels = LEVELS.map((level) => {
    const values = prior.filter((r) => r.level === level).map(scoredFirstMs);
    const avg = mean(values);
    const record = summary.records[level];
    const current = record ? scoredFirstMs(record) : undefined;
    const change =
      current !== undefined && values.length >= 5 && avg > 0 ? (current / avg - 1) * 100 : null;
    return { level, values, avg, current, change };
  });
  const comparisons = levels
    .filter((l) => l.change !== null && Number.isFinite(l.change))
    .sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!));
  const usual = comparisons[0];
  if (usual && Math.abs(usual.change!) >= 1)
    add(
      "usual",
      "history",
      "Against your usual",
      `${name(usual.level)} · ${Math.abs(usual.change!).toFixed(1)}% ${usual.change! < 0 ? "quicker" : "slower"}`,
      `Compared with ${usual.values.length} prior first solves.`,
      70 + Math.min(24, Math.abs(usual.change!) / 2),
    );
  const ranks = levels
    .filter((l) => l.current !== undefined && l.values.length >= 5)
    .map((l) => ({
      ...l,
      rank: 1 + l.values.filter((v) => v < l.current!).length,
      tied: l.values.includes(l.current!),
    }))
    .filter((l) => l.rank <= 3)
    .sort((a, b) => a.rank - b.rank || b.values.length - a.values.length);
  const podium = ranks[0];
  if (podium)
    add(
      "podium",
      "history",
      "Personal podium",
      `${name(podium.level)} · ${podium.tied ? "Tied " : ""}#${podium.rank} of ${podium.values.length + 1}`,
      `Today plus ${podium.values.length} prior first solves.`,
      99 - (podium.rank - 1) * 4,
    );
  if (levels.every((l) => l.change !== null && l.change < 0))
    add(
      "sweep",
      "history",
      "Clean sweep",
      "All three quicker than usual",
      levels.map((l) => `${name(l.level)}: ${l.values.length} prior solves`).join(" · "),
      100,
    );
  const trends = levels
    .filter((l) => l.values.length >= 14)
    .map((l) => {
      const recent = mean(l.values.slice(0, 7));
      const older = mean(l.values.slice(7, 14));
      return { ...l, change: older > 0 ? (recent / older - 1) * 100 : null };
    })
    .filter((l) => l.change !== null && Number.isFinite(l.change) && Math.abs(l.change) >= 1)
    .sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!));
  const trend = trends[0];
  if (trend)
    add(
      "moving",
      "history",
      "Moving average",
      `${name(trend.level)} · ${Math.abs(trend.change!).toFixed(1)}% ${trend.change! < 0 ? "quicker" : "slower"}`,
      "Last 7 prior first solves versus the 7 before them; today excluded.",
      75 + Math.min(20, Math.abs(trend.change!) / 2),
    );
  return facts;
}
