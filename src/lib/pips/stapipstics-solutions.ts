import { LEVELS } from "./engine";
import type { DayResults } from "./daily-results";
import type { DayAnalysis } from "./puzzle-analysis";
import type { Stapipstic } from "./stapipstics-candidates";
export function winningFact(summary: DayResults, analysis: DayAnalysis): Stapipstic | null {
  const values = LEVELS.flatMap((level) => {
    const a = analysis[level];
    if (!summary.records[level] || !a || a.date !== summary.date) return [];
    const count = a.winning;
    if (count.status === "invalid" || (count.status === "exact" && count.count === "0")) return [];
    const label = level[0].toUpperCase() + level.slice(1);
    return [
      `${label}: ${count.status === "exact" ? BigInt(count.count).toLocaleString("en-US") : count.lowerBound === "0" ? "Count incomplete" : `At least ${BigInt(count.lowerBound).toLocaleString("en-US")} — count incomplete`}`,
    ];
  });
  return values.length
    ? {
        id: "solutions",
        family: "curiosity",
        group: "solutions",
        label: "Winning arrangements",
        value: values.join(" · "),
        explanation: "Different completed boards, ignoring identical-tile swaps.",
      }
    : null;
}
