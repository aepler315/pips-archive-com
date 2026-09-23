import { scoredFirstMs } from "./hints";
import { LEVELS, type RawDay } from "./engine";
import { buildDailyResults, type DayResults } from "./daily-results";

export type Stapipstic = {
  id: string;
  family: "timing" | "composition" | "curiosity";
  group:
    "solutions" | "halves" | "pairs" | "rules" | "timing" | "rate" | "history" | "cross-puzzle";
  label: string;
  value: string;
  explanation: string;
};
const decimal = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(1);

export function getStapipsticCandidates(input: DayResults, raw: RawDay): Stapipstic[] {
  const summary = buildDailyResults(input.date, input.records);
  const facts: Stapipstic[] = [];
  const add = (
    id: string,
    group: Stapipstic["group"],
    label: string,
    value: string,
    explanation = "",
  ) => {
    const family = group === "timing" ? "timing" : group === "rate" ? "curiosity" : "composition";
    facts.push({ id, group, family, label, value, explanation });
  };
  const dominoes = LEVELS.flatMap((l) => raw[l].dominoes);
  const validPips =
    raw.printDate === summary.date &&
    dominoes.every(
      (d) => d.length === 2 && d.every((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    );
  const halves = dominoes.flat();
  const payload = halves.reduce((a, b) => a + b, 0);
  if (validPips) {
    add(
      "payload",
      "halves",
      "Pip payload",
      `${payload} pips`,
      "Every pip across all three puzzles.",
    );
    if (dominoes.length) {
      const doubles = dominoes.filter(([a, b]) => a === b).length;
      add(
        "doubles",
        "pairs",
        "Double trouble",
        `${doubles} of ${dominoes.length} · ${decimal((doubles / dominoes.length) * 100)}%`,
        "Dominoes with matching halves.",
      );
      for (const [pip, id, label] of [
        [0, "zeros", "Nothing to see here"],
        [6, "sixes", "Six appeal"],
      ] as const) {
        const count = halves.filter((n) => n === pip).length;
        add(
          id,
          "halves",
          label,
          `${count} of ${halves.length} · ${decimal((count / halves.length) * 100)}%`,
          pip === 0
            ? "Blank halves across all three puzzles."
            : "Halves showing six across all three puzzles.",
        );
      }
      const counts = Array.from({ length: 7 }, (_, pip) => halves.filter((n) => n === pip).length);
      const most = Math.max(...counts);
      const common = counts.flatMap((n, pip) => (n === most ? [pip] : []));
      add(
        "common",
        "halves",
        common.length === 1 ? "Main character" : "Sharing the spotlight",
        common.join(" & "),
        common.length === 1
          ? `${most} of ${halves.length} halves · ${decimal((most / halves.length) * 100)}% of the set.`
          : `Each appears on ${most} of ${halves.length} halves.`,
      );
      const missing = counts.flatMap((n, pip) => (n === 0 ? [pip] : []));
      if (missing.length)
        add(
          "missing",
          "halves",
          "Missing in action",
          missing.join(", "),
          "Pip values that never appear today.",
        );
      const odd = halves.filter((n) => n % 2 === 1).length;
      add(
        "parity",
        "halves",
        "Odd company",
        `${odd} odd · ${halves.length - odd} even`,
        "Pip values across all halves; blanks count as even.",
      );
      const pairs = new Set(dominoes.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
      const repeats = dominoes.length - pairs.size;
      if (repeats)
        add(
          "repeats",
          "pairs",
          "Domino déjà vu",
          `${repeats} repeat${repeats === 1 ? "" : "s"}`,
          `${dominoes.length} dominoes, ${pairs.size} distinct pip pairs.`,
        );
      const neighbors = dominoes.filter(([a, b]) => Math.abs(a - b) === 1).length;
      if (neighbors)
        add(
          "neighbors",
          "pairs",
          "Next-door neighbors",
          `${neighbors} of ${dominoes.length} dominoes`,
          "Their two halves differ by exactly one pip.",
        );
      const maxLoad = Math.max(...dominoes.map(([a, b]) => a + b));
      const heavy = dominoes.filter(([a, b]) => a + b === maxLoad).length;
      add(
        "heavy",
        "pairs",
        "Heavy hitters",
        `${maxLoad} pips`,
        `${heavy} domino${heavy === 1 ? " has" : "es share"} the largest pip total.`,
      );
    }
    const regions = LEVELS.flatMap((l) => raw[l].regions);
    const rules = [
      ["sum", "sum"],
      ["equals", "equal"],
      ["unequal", "different"],
      ["less", "less-than"],
      ["greater", "greater-than"],
    ] as const;
    const known = new Set<string>(["empty", ...rules.map(([type]) => type)]);
    if (regions.every((r) => known.has(r.type))) {
      const mix = rules
        .map(([type, label]) => ({ label, count: regions.filter((r) => r.type === type).length }))
        .filter((r) => r.count > 0);
      if (mix.length)
        add(
          "rules",
          "rules",
          "House rules",
          `${mix.length} rule type${mix.length === 1 ? "" : "s"}`,
          mix.map((r) => `${r.count} ${r.label}`).join(" · ") + ".",
        );
      const cells = regions.reduce((n, r) => n + r.indices.length, 0);
      const free = regions
        .filter((r) => r.type === "empty")
        .reduce((n, r) => n + r.indices.length, 0);
      if (cells && free)
        add(
          "free",
          "rules",
          "Free real estate",
          `${free} of ${cells} cells`,
          "Cells with no region rule to satisfy.",
        );
    }
  }
  if (summary.complete && summary.totalMs !== null && summary.totalMs > 0) {
    const total = summary.totalMs;
    add(
      "hard",
      "timing",
      "The Hard tax",
      `${decimal((scoredFirstMs(summary.records.hard!) / total) * 100)}%`,
      "Hard’s share of your total solve time.",
    );
    const throughput = payload / (total / 60000);
    if (validPips && Number.isFinite(throughput))
      add("throughput", "rate", "Pip throughput", `${decimal(throughput)} pips/min`);
    const pace = total / 1000 / dominoes.length;
    if (validPips && dominoes.length && Number.isFinite(pace))
      add(
        "pace",
        "rate",
        "Domino tempo",
        `${decimal(pace)} sec/domino`,
        `Total solve time ÷ ${dominoes.length} dominoes.`,
      );
  }
  return facts;
}
