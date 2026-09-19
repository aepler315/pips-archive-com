import { LEVELS, type RawDay } from "./engine";
import { buildDailyResults, formatResultDuration, type DayResults } from "./daily-results";

export type Stapipstic = {
  id: string;
  family: "timing" | "composition" | "curiosity";
  label: string;
  value: string;
  explanation: string;
};
const decimal = (n: number) => (Object.is(n, -0) ? 0 : n).toFixed(1);
const title = (s: string) => s[0].toUpperCase() + s.slice(1);

export function getStapipsticCandidates(input: DayResults, raw: RawDay): Stapipstic[] {
  const summary = buildDailyResults(input.date, input.records);
  const facts: Stapipstic[] = [];
  const add = (
    id: string,
    family: Stapipstic["family"],
    label: string,
    value: string,
    explanation: string,
  ) => facts.push({ id, family, label, value, explanation });
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
      "composition",
      "Pip payload",
      `${payload} pips`,
      "Every pip on every domino across the three puzzles.",
    );
    if (dominoes.length) {
      const doubles = dominoes.filter(([a, b]) => a === b).length;
      add(
        "doubles",
        "composition",
        "Double trouble",
        `${doubles} of ${dominoes.length} · ${decimal((doubles / dominoes.length) * 100)}%`,
        "Dominoes with matching halves, including blank doubles.",
      );
      for (const [pip, id, label] of [
        [0, "zeros", "Nothing to see here"],
        [6, "sixes", "Six appeal"],
      ] as const) {
        const count = halves.filter((n) => n === pip).length;
        add(
          id,
          "composition",
          label,
          `${count} of ${halves.length} · ${decimal((count / halves.length) * 100)}%`,
          pip === 0
            ? "Blank halves across all three puzzles."
            : "Halves showing six across all three puzzles.",
        );
      }
    }
  }
  if (summary.complete && summary.totalMs !== null) {
    const total = summary.totalMs;
    const easy = summary.records.easy!.first,
      hard = summary.records.hard!.first;
    if (total > 0) {
      add(
        "hard",
        "timing",
        "The Hard tax",
        `${decimal((hard / total) * 100)}%`,
        "Hard’s share of your total recorded solving time.",
      );
      const throughput = payload / (total / 60000);
      if (validPips && Number.isFinite(throughput))
        add(
          "throughput",
          "curiosity",
          "Pip throughput",
          `${decimal(throughput)} pips/min`,
          "Total pips divided by recorded solve minutes; an average, not measured interaction speed.",
        );
    }
    add(
      "comparison",
      "timing",
      easy > hard ? "Plot twist" : "Easy meets Hard",
      formatResultDuration(Math.abs(easy - hard)),
      easy === hard
        ? "Easy and Hard took exactly the same recorded time."
        : `${easy > hard ? "Easy" : "Hard"} took this much longer than ${easy > hard ? "Hard" : "Easy"}.`,
    );
    const times = LEVELS.map((l) => summary.records[l]!.first);
    const min = Math.min(...times),
      max = Math.max(...times);
    const names = (ms: number) =>
      LEVELS.filter((l) => summary.records[l]!.first === ms)
        .map(title)
        .join(" & ");
    add(
      "gap",
      "timing",
      "The time gap",
      formatResultDuration(max - min),
      min === max
        ? "All three recorded times are tied."
        : `${names(max)} (longest) minus ${names(min)} (shortest); tied levels share their place.`,
    );
  }
  return facts;
}

// Explicit stable ranking: no randomness or history-dependent comparisons.
function hash(text: string): number {
  let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return n >>> 0;
}
export function getStapipstics(summary: DayResults, raw: RawDay): Stapipstic[] {
  const seed = `stapipstics-v1:${summary.date}:${LEVELS.map((l) => summary.records[l]?.first ?? "missing").join(":")}`;
  const candidates = getStapipsticCandidates(summary, raw).sort(
    (a, b) =>
      hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const selected: Stapipstic[] = [];
  for (const family of ["timing", "composition"] as const) {
    const fact = candidates.find((f) => f.family === family);
    if (fact) selected.push(fact);
  }
  for (const fact of candidates) {
    if (selected.length >= 3) break;
    if (!selected.some((f) => f.id === fact.id)) selected.push(fact);
  }
  return selected;
}
