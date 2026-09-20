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

const exponent = (value: bigint) => {
  const digits = value.toString();
  return `${digits[0]}.${digits[1]} × 10^${digits.length - 1}`;
};

/** Tenths of `size`, rounded half up rather than floored: plain integer
 *  division would render 1,999,999 as "1.9 million". */
const tenths = (value: bigint, size: bigint) => (value * 10n + size / 2n) / size;

/** A board count is a headline number, not an audit figure: 2.4 billion reads,
 *  2,412,883,904 does not. Exact below a million, rounded above it, and in
 *  exponent form past a quintillion where the scale words run out. */
export function approxCount(value: bigint): string {
  if (value < 1_000_000n) return value.toLocaleString("en-US");
  if (value >= 10n ** 21n) return exponent(value);
  const index = SCALES.findIndex(([threshold]) => value >= threshold);
  let [size, word] = SCALES[index];
  let scaled = tenths(value, size);
  // Rounding can carry a value over its own scale — 999,999,999 is "1 billion",
  // not "999.9 million" — so promote it rather than printing four digits.
  if (scaled >= 10_000n) {
    if (index === 0) return exponent(value);
    [size, word] = SCALES[index - 1];
    scaled = tenths(value, size);
  }
  const rounded = Number(scaled) / 10;
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

const listNames = (items: { level: Level }[]) => {
  const names = items.map((item) => name(item.level));
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

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
  if (high.winning !== low.winning) return spread;
  // "Every board" is only true when every level was actually counted; an
  // unsolved or uncounted one is omitted above and may differ, so name the
  // boards the tie really covers.
  return entries.length === LEVELS.length
    ? `Every board had exactly ${ways(high.winning)} to finish.`
    : `${listNames(entries)} each had exactly ${ways(high.winning)} to finish.`;
}
