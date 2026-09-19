import { LEVELS, type RawDay } from "./engine";
import { buildDailyResults, type DayResults } from "./daily-results";
import { getStapipsticCandidates, type Stapipstic } from "./stapipstics-candidates";

import { historyFacts } from "./stapipstics-history";
import { timingFacts } from "./stapipstics-timing";
import { compositionFacts } from "./stapipstics-composition";
import type { ResultHistory } from "./stapipstics-extra-types";

export type Evaluation = {
  id: string;
  fact: Stapipstic | null;
  score: number;
  selected: boolean;
  reason:
    "insufficient-data" | "already-shown" | "selected" | "overlapping-subject" | "lower-ranked";
};
// Editorial salience, not population percentiles. Scores reward concentration,
// extremes, and rule variety. The fixed catalog order breaks exact ties.
export function evaluateStapipstics(
  input: DayResults,
  raw: RawDay,
  history: ResultHistory = [],
): Evaluation[] {
  const summary = buildDailyResults(input.date, input.records);
  const candidates = new Map(getStapipsticCandidates(summary, raw).map((f) => [f.id, f]));
  const dominoes = LEVELS.flatMap((l) => raw[l].dominoes);
  const halves = dominoes.flat();
  const fraction = (n: number, total: number) => (total ? n / total : 0);
  const counts = Array.from({ length: 7 }, (_, pip) => halves.filter((n) => n === pip).length);
  const pairs = new Set(dominoes.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
  const regions = LEVELS.flatMap((l) => raw[l].regions);
  const cells = regions.reduce((n, r) => n + r.indices.length, 0);
  const odd = fraction(halves.filter((n) => n % 2 === 1).length, halves.length);
  const seconds = (summary.totalMs ?? 0) / 1000;
  const scores: Record<string, number> = {
    payload: 25,
    doubles: 40 + 45 * fraction(dominoes.filter(([a, b]) => a === b).length, dominoes.length),
    zeros: 35 + 65 * fraction(counts[0], halves.length),
    sixes: 35 + 65 * fraction(counts[6], halves.length),
    common: 45 + 35 * fraction(Math.max(...counts), halves.length),
    missing: 40 + 7 * counts.filter((n) => n === 0).length,
    parity: odd === 0.5 ? 70 : 35 + 40 * Math.abs(2 * odd - 1),
    repeats: 40 + 45 * fraction(dominoes.length - pairs.size, dominoes.length),
    neighbors:
      35 +
      45 * fraction(dominoes.filter(([a, b]) => Math.abs(a - b) === 1).length, dominoes.length),
    heavy: 30 + 20 * fraction(Math.max(0, ...dominoes.map(([a, b]) => a + b)), 12),
    rules: 35 + 10 * new Set(regions.filter((r) => r.type !== "empty").map((r) => r.type)).size,
    free:
      40 +
      35 *
        fraction(
          regions.filter((r) => r.type === "empty").reduce((n, r) => n + r.indices.length, 0),
          cells,
        ),
    hard: 0,
    throughput:
      30 + Math.min(20, Math.log1p(fraction(halves.reduce((a, b) => a + b, 0) * 60, seconds)) * 5),
    pace: 30 + 20 / (1 + fraction(seconds, dominoes.length) / 10),
  };
  const evaluations: Evaluation[] = Object.entries(scores).map(([id, score]) => {
    const fact = candidates.get(id) ?? null;
    return {
      id,
      fact,
      score: fact && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
      selected: false,
      reason: !fact ? "insufficient-data" : id === "hard" ? "already-shown" : "lower-ranked",
    };
  });
  for (const extra of [
    ...historyFacts(summary, history),
    ...timingFacts(summary),
    ...compositionFacts(summary, raw),
  ]) {
    evaluations.push({
      ...extra,
      selected: false,
      reason: extra.fact ? "lower-ranked" : "insufficient-data",
    });
  }
  const groups = new Set<Stapipstic["group"]>();
  for (const evaluation of [...evaluations].sort((a, b) => b.score - a.score)) {
    if (!evaluation.fact || evaluation.reason === "already-shown") continue;
    if (groups.has(evaluation.fact.group)) evaluation.reason = "overlapping-subject";
    else if (groups.size < 3) {
      evaluation.selected = true;
      evaluation.reason = "selected";
      groups.add(evaluation.fact.group);
    }
  }
  return evaluations;
}
export function getStapipstics(
  summary: DayResults,
  raw: RawDay,
  history: ResultHistory = [],
): Stapipstic[] {
  return evaluateStapipstics(summary, raw, history)
    .filter((e) => e.selected)
    .sort((a, b) => b.score - a.score)
    .map((e) => e.fact!);
}
