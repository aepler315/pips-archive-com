import { LEVELS, type RawDay, type Level } from "./engine";
import { hashPuzzle } from "./puzzle-content";
import type { CountResult, PuzzleAnalysis } from "./puzzle-analysis-types";
export type DayAnalysis = Partial<Record<Level, PuzzleAnalysis>>;
export const COUNTING_VERSION = "winning-arrangements-v1";
export const EQUIVALENCE_VERSION = "fixed-board-unlabeled-dominoes-v1";
const decimal = (v: unknown): v is string =>
  typeof v === "string" && /^(0|[1-9]\d*)$/.test(v) && v.length <= 10000;
export function validCount(v: unknown): v is CountResult {
  if (!v || typeof v !== "object") return false;
  const r = v as CountResult;
  if (r.status === "exact") return decimal(r.count);
  if (r.status === "invalid") return typeof r.reason === "string";
  return (
    r.status === "bounded" &&
    decimal(r.lowerBound) &&
    ["node-budget", "time-budget", "memory-budget"].includes(r.reason)
  );
}
export function validAnalysis(
  value: unknown,
  date: string,
  level: Level,
  hash: string,
): value is PuzzleAnalysis {
  if (!value || typeof value !== "object") return false;
  const a = value as PuzzleAnalysis;
  if (
    a.schemaVersion !== 1 ||
    a.date !== date ||
    a.level !== level ||
    a.puzzleHash !== hash ||
    a.countingVersion !== COUNTING_VERSION ||
    a.equivalenceVersion !== EQUIVALENCE_VERSION ||
    !validCount(a.winning) ||
    !validCount(a.unconstrained)
  )
    return false;
  if (
    a.winning.status === "invalid" ||
    a.unconstrained.status === "invalid" ||
    (a.winning.status === "exact" && a.winning.count === "0")
  )
    return false;
  if (
    a.constraintInformationBits !== null &&
    (!Number.isFinite(a.constraintInformationBits) ||
      a.constraintInformationBits < 0 ||
      a.winning.status !== "exact" ||
      a.unconstrained.status !== "exact")
  )
    return false;
  if (
    a.unconstrained.status === "exact" &&
    BigInt(a.winning.status === "exact" ? a.winning.count : a.winning.lowerBound) >
      BigInt(a.unconstrained.count)
  )
    return false;
  const s = a.structural;
  if (
    s !== null &&
    (!s ||
      !["complete", "bounded"].includes(s.status) ||
      s.solverVersion !== "first-solution-v1" ||
      !Array.isArray(s.seeds) ||
      s.seeds.length !== 8 ||
      !s.seeds.every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff) ||
      ![s.medianFirstSolutionNodes, s.rootForcedFraction, s.maxDecisionDepth, s.percentile].every(
        (n) => n === null || (Number.isFinite(n) && n >= 0),
      ) ||
      (s.rootForcedFraction !== null && s.rootForcedFraction > 1) ||
      (s.percentile !== null && (s.percentile > 100 || !s.referenceVersion)) ||
      (s.status === "bounded" && (s.medianFirstSolutionNodes !== null || s.percentile !== null)))
  )
    return false;
  return true;
}
export async function validateDayAnalysis(value: unknown, raw: RawDay): Promise<DayAnalysis> {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { schemaVersion?: number }).schemaVersion !== 1
  )
    return {};
  const entries = (value as { analyses?: Record<string, unknown> }).analyses;
  const out: DayAnalysis = {};
  await Promise.all(
    LEVELS.map(async (level) => {
      try {
        const hash = await hashPuzzle(raw[level]);
        const value = entries?.[level];
        if (validAnalysis(value, raw.printDate, level, hash)) out[level] = value;
      } catch {
        /* unavailable metadata never blocks play */
      }
    }),
  );
  return out;
}
const requests = new Map<string, Promise<unknown>>();
export async function loadDayAnalysis(raw: RawDay): Promise<DayAnalysis> {
  const url = `/data/analysis/${raw.printDate}.json`;
  if (!requests.has(url)) {
    if (requests.size >= 32) requests.delete(requests.keys().next().value!);
    requests.set(
      url,
      fetch(url, { signal: AbortSignal.timeout(5000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  return validateDayAnalysis(await requests.get(url), raw);
}
