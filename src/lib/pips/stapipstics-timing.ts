import { LEVELS } from "./engine";
import { formatResultDuration as duration, type DayResults } from "./daily-results";
import { collector, name, gapText } from "./stapipstics-extra-types";
export function timingFacts(summary: DayResults) {
  const { facts, add } = collector(["photo", "plot", "steady", "long-short", "majority"]);
  if (!summary.complete || summary.totalMs === null || !Number.isFinite(summary.totalMs))
    return facts;
  const times = LEVELS.map((level) => ({ level, time: summary.records[level]!.first }));
  const pairs = times.flatMap((a, i) =>
    times.slice(i + 1).map((b) => ({ a, b, gap: Math.abs(a.time - b.time) })),
  );
  const close = [...pairs].sort((a, b) => a.gap - b.gap)[0];
  const closeness = close.gap / Math.max(close.a.time, close.b.time, 1);
  if (close.gap <= 5000 || closeness <= 0.05)
    add(
      "photo",
      "timing",
      "Photo finish",
      close.gap === 0 ? "An exact tie" : `${gapText(close.gap)} apart`,
      `${name(close.a.level)} and ${name(close.b.level)}.`,
      close.gap === 0 ? 99 : 90 + 8 * (1 - Math.min(1, closeness)),
    );
  if (summary.totalMs === 0) return facts;
  const reversal = pairs.filter((p) => p.b.time < p.a.time).sort((a, b) => b.gap - a.gap)[0];
  if (reversal)
    add(
      "plot",
      "timing",
      "Plot twist",
      `${name(reversal.b.level)} was ${gapText(reversal.gap)} quicker`,
      `Than ${name(reversal.a.level)}, despite the higher difficulty.`,
      94 + (5 * reversal.gap) / reversal.a.time,
    );
  const sorted = [...times].sort((a, b) => a.time - b.time);
  const fastest = sorted[0],
    slowest = sorted[2];
  const spread = slowest.time - fastest.time;
  if (spread / slowest.time <= 0.2)
    add(
      "steady",
      "timing",
      "Steady hands",
      `${gapText(spread)} from fastest to slowest`,
      "The spread across all three first-solve times.",
      88 + 10 * (1 - spread / slowest.time),
    );
  if (
    fastest.time > 0 &&
    Number.isFinite(slowest.time / fastest.time) &&
    slowest.time / fastest.time >= 2
  )
    add(
      "long-short",
      "timing",
      "The long and short",
      `${(slowest.time / fastest.time).toFixed(1)}× as long`,
      `${name(slowest.level)} compared with ${name(fastest.level)}.`,
      65 + Math.min(20, slowest.time / fastest.time),
    );
  const rest = summary.totalMs - slowest.time;
  if (slowest.time > rest)
    add(
      "majority",
      "timing",
      "One-person majority",
      `${name(slowest.level)} outlasted the other two`,
      `${duration(slowest.time)} versus ${duration(rest)} combined.`,
      74 + (15 * slowest.time) / summary.totalMs,
    );
  return facts;
}
