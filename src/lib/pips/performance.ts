import { LEVELS, type Level } from "./engine";
import type { AnchorRecord, LevelBaseline, PerformanceBaseline } from "./performance-types";
export const emptyBaseline = (): PerformanceBaseline => ({
  schemaVersion: 1,
  modelVersion: "level-anchor-v1",
  levels: {},
});
const time = (s: string) => Date.parse(s);
export const eligible = (r: AnchorRecord) =>
  !!r &&
  LEVELS.includes(r.level) &&
  /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
  Number.isFinite(time(r.date)) &&
  new Date(r.date).toISOString().slice(0, 10) === r.date &&
  Number.isFinite(r.first) &&
  r.first > 0 &&
  typeof r.solvedAt === "string" &&
  Number.isFinite(time(r.solvedAt));
export const orderedRecords = <T extends AnchorRecord>(
  records: T[],
  asOf = "9999-12-31T23:59:59.999Z",
) => {
  const seen = new Set<string>();
  return records
    .filter((r) => eligible(r) && time(r.solvedAt) <= time(asOf))
    .sort(
      (a, b) =>
        time(a.solvedAt) - time(b.solvedAt) ||
        a.date.localeCompare(b.date) ||
        a.level.localeCompare(b.level),
    )
    .filter((r) => {
      const key = `${r.date}:${r.level}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;
export function deriveLevelBaseline(
  records: AnchorRecord[],
  existing?: LevelBaseline | null,
): LevelBaseline | null {
  if (existing) return existing;
  const anchor = orderedRecords(records)
    .slice(0, 10)
    .map(({ date, level, first, solvedAt }) => ({ date, level, first, solvedAt }));
  if (anchor.length !== 10 || new Set(anchor.map((r) => r.level)).size !== 1) return null;
  return {
    anchor,
    cutoff: anchor[9].solvedAt,
    logExpectedMs: mean(anchor.map((r) => Math.log(r.first))),
  };
}
const displayScore = (log: number) => 100 * Math.exp(Math.max(-700, Math.min(700, log)));
export function scoreFirstResult(result: AnchorRecord, baseline?: LevelBaseline | null) {
  if (
    !baseline ||
    !eligible(result) ||
    baseline.anchor[0]?.level !== result.level ||
    time(result.solvedAt) <= time(baseline.cutoff) ||
    baseline.anchor.some((a) => a.date === result.date && a.level === result.level)
  )
    return null;
  const logPerformance = baseline.logExpectedMs - Math.log(result.first);
  return { logPerformance, score: displayScore(logPerformance) };
}
export function summarizeCurrentForm(
  records: AnchorRecord[],
  baseline: PerformanceBaseline,
  asOf?: string,
) {
  const ordered = orderedRecords(records, asOf);
  const levels = Object.fromEntries(
    LEVELS.map((level) => {
      const base = baseline.levels[level];
      const scored = ordered
        .filter((r) => r.level === level)
        .flatMap((r) => {
          const score = scoreFirstResult(r, base);
          return score ? [{ ...r, ...score }] : [];
        })
        .slice(-10);
      const log = scored.length ? mean(scored.map((r) => r.logPerformance)) : null;
      return [
        level,
        {
          calibration: base ? 10 : Math.min(10, ordered.filter((r) => r.level === level).length),
          count: scored.length,
          from: scored[0]?.solvedAt ?? null,
          to: scored.at(-1)?.solvedAt ?? null,
          logPerformance: log,
          score: log === null ? null : displayScore(log),
        },
      ];
    }),
  ) as Record<
    Level,
    {
      calibration: number;
      count: number;
      from: string | null;
      to: string | null;
      logPerformance: number | null;
      score: number | null;
    }
  >;
  const ready = LEVELS.every((l) => levels[l].count >= 3);
  return {
    levels,
    status: !ready
      ? "calibrating"
      : LEVELS.every((l) => levels[l].count === 10)
        ? "complete"
        : "provisional",
    score: ready ? displayScore(mean(LEVELS.map((l) => levels[l].logPerformance!))) : null,
  };
}
export function validateBaseline(
  value: unknown,
  records: AnchorRecord[],
): PerformanceBaseline | null {
  if (!value || typeof value !== "object") return null;
  const b = value as PerformanceBaseline;
  if (
    b.schemaVersion !== 1 ||
    b.modelVersion !== "level-anchor-v1" ||
    !b.levels ||
    typeof b.levels !== "object" ||
    Array.isArray(b.levels) ||
    Object.keys(b.levels).some((l) => !LEVELS.includes(l as Level))
  )
    return null;
  const levels: PerformanceBaseline["levels"] = {};
  for (const level of LEVELS) {
    const v = b.levels[level];
    if (v === undefined) continue;
    if (
      !v ||
      !Array.isArray(v.anchor) ||
      v.anchor.length !== 10 ||
      !v.anchor.every(
        (a) =>
          eligible(a) &&
          a.level === level &&
          records.some(
            (r) =>
              r.date === a.date &&
              r.level === a.level &&
              r.first === a.first &&
              r.solvedAt === a.solvedAt,
          ),
      )
    )
      return null;
    const derived = deriveLevelBaseline(v.anchor);
    if (
      !derived ||
      derived.cutoff !== v.cutoff ||
      !Number.isFinite(v.logExpectedMs) ||
      Math.abs(derived.logExpectedMs - v.logExpectedMs) > 1e-12
    )
      return null;
    levels[level] = derived;
  }
  return { schemaVersion: 1, modelVersion: "level-anchor-v1", levels };
}
export function formatPerformance(score: number | null) {
  return score === null ? "—" : score > 9999 ? ">9,999" : score < 0.1 ? "<0.1" : score.toFixed(1);
}

export function buildPerformanceTimeline(records: AnchorRecord[], baseline: PerformanceBaseline) {
  const windows: Record<Level, number[]> = { easy: [], medium: [], hard: [] };
  const points: ({ completed: number } & Record<Level, number | null>)[] = [];
  for (const r of orderedRecords(records)) {
    const score = scoreFirstResult(r, baseline.levels[r.level]);
    if (score) {
      windows[r.level].push(score.logPerformance);
      if (windows[r.level].length > 10) windows[r.level].shift();
    }
    const point = {
      completed: Date.parse(r.solvedAt),
      ...Object.fromEntries(
        LEVELS.map((l) => [l, windows[l].length ? displayScore(mean(windows[l])) : null]),
      ),
    } as (typeof points)[number];
    if (points.at(-1)?.completed === point.completed) points[points.length - 1] = point;
    else points.push(point);
  }
  return points;
}
