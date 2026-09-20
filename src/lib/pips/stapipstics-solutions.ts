import { LEVELS, type Level } from "./engine";
import type { DayResults } from "./daily-results";
import type { DayAnalysis } from "./puzzle-analysis";
import type { Stapipstic } from "./stapipstics-candidates";
import { name } from "./stapipstics-extra-types";

export const WAYS_TO_FINISH_LABEL = "Ways to finish";

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
        label: WAYS_TO_FINISH_LABEL,
        value: values.join(" · "),
        explanation: "Different completed boards, ignoring identical-tile swaps.",
      }
    : null;
}

const SCALES = [
  [10n ** 18n, "quintillion"],
  [10n ** 15n, "quadrillion"],
  [10n ** 12n, "trillion"],
  [10n ** 9n, "billion"],
  [10n ** 6n, "million"],
] as const;

/** A board count is a headline number, not an audit figure: 2.4 billion reads,
 *  2,412,883,904 does not. Exact below a million, rounded above it, and in
 *  exponent form past a quintillion where the scale words run out. */
export function approxCount(value: bigint): string {
  if (value < 1_000_000n) return value.toLocaleString("en-US");
  if (value >= 10n ** 21n) {
    const digits = value.toString();
    return `${digits[0]}.${digits[1]} × 10^${digits.length - 1}`;
  }
  const [size, word] = SCALES.find(([threshold]) => value >= threshold)!;
  const rounded = Number((value * 10n) / size) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${word}`;
}

/** "3.5×", "1,240×". Falls back to integer division once the ratio outgrows a
 *  float, which it does on puzzles whose counts differ by many orders. */
function multiple(a: bigint, b: bigint): string {
  const value = Number((a * 100n) / b) / 100;
  if (Number.isFinite(value) && value < 10)
    return `${Number.isInteger(value) ? value : value.toFixed(1)}×`;
  return `${approxCount(a / b)}×`;
}

const ways = (n: bigint) => (n === 1n ? "one way" : `${approxCount(n)} ways`);
const plain = (n: bigint) => (n === 1n ? "one" : approxCount(n));

type Counted = { level: Level; winning: bigint; unconstrained: bigint | null };

/** Solved levels whose sidecar matches this date and counted exactly. A bounded
 *  or invalid count cannot carry a comparison, so it is left out entirely. */
function counted(summary: DayResults, analysis: DayAnalysis): Counted[] {
  return LEVELS.flatMap((level) => {
    const a = analysis[level];
    if (!summary.records[level] || !a || a.date !== summary.date) return [];
    if (a.winning.status !== "exact") return [];
    const winning = BigInt(a.winning.count);
    if (winning <= 0n) return [];
    const total = a.unconstrained.status === "exact" ? BigInt(a.unconstrained.count) : null;
    return [{ level, winning, unconstrained: total !== null && total > winning ? total : null }];
  });
}

/** One sentence putting the day's counts in context. Two stories are available
 *  and the numbers decide which gets told: when the three puzzles disagree
 *  sharply the spread between them is the point, and when they agree it is how
 *  far the rules narrowed the board that is worth saying. */
export function solutionSummary(summary: DayResults, analysis: DayAnalysis): string | null {
  const entries = counted(summary, analysis);
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => (a.winning < b.winning ? -1 : 1));
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const spread = `${name(high.level)} had ${multiple(high.winning, low.winning)} as many ways to finish as ${name(low.level)}.`;
  if (entries.length > 1 && high.winning / low.winning >= 10n) return spread;

  const narrowed = entries
    .filter((e): e is Counted & { unconstrained: bigint } => e.unconstrained !== null)
    .sort((a, b) => {
      const ratioA = a.unconstrained / a.winning;
      const ratioB = b.unconstrained / b.winning;
      return ratioA < ratioB ? 1 : ratioA > ratioB ? -1 : 0;
    })[0];
  if (narrowed)
    return `${name(narrowed.level)}'s rules ruled out all but ${plain(narrowed.winning)} of ${approxCount(narrowed.unconstrained)} possible layouts.`;

  if (entries.length === 1) return null;
  return high.winning === low.winning
    ? `Every board had exactly ${ways(high.winning)} to finish.`
    : spread;
}
