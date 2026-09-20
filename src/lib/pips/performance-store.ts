import { LEVELS } from "./engine";
import { deriveLevelBaseline, emptyBaseline, validateBaseline } from "./performance";
import type { Analytics, AnchorRecord, CompletionContext } from "./performance-types";
import { allResults, withResultLock, notifyResults } from "./store";
export const ANALYTICS_KEY = "pips-archive:v1:analytics";
export function validateAnalytics(value: unknown, records: AnchorRecord[]): Analytics | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Analytics,
    baseline = validateBaseline(a.baseline, records);
  if (a.schemaVersion !== 1 || !baseline || !Array.isArray(a.contexts)) return null;
  const seen = new Set<string>();
  const contexts: CompletionContext[] = [];
  for (const c of a.contexts) {
    if (
      !c ||
      typeof c.puzzleHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(c.puzzleHash) ||
      !records.some(
        (r) =>
          r.date === c.date &&
          r.level === c.level &&
          r.first === c.first &&
          r.solvedAt === c.solvedAt,
      )
    )
      return null;
    const key = `${c.date}:${c.level}`;
    if (seen.has(key)) return null;
    seen.add(key);
    contexts.push({
      date: c.date,
      level: c.level,
      first: c.first,
      solvedAt: c.solvedAt,
      puzzleHash: c.puzzleHash,
    });
  }
  return { schemaVersion: 1, baseline, contexts };
}
export function readAnalytics(records: AnchorRecord[]): Analytics | null {
  try {
    return validateAnalytics(JSON.parse(localStorage.getItem(ANALYTICS_KEY) ?? "null"), records);
  } catch {
    return null;
  }
}
// Caller holds the shared result lock. Never acquire it recursively.
export function saveAnalyticsUnderLock(
  records: AnchorRecord[],
  context?: CompletionContext,
): boolean {
  try {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    const prior = readAnalytics(records);
    if (stored !== null && !prior) return false; // Do not silently rebase corrupt metadata.
    const a: Analytics = prior ?? { schemaVersion: 1, baseline: emptyBaseline(), contexts: [] };
    for (const level of LEVELS) {
      const baseline = deriveLevelBaseline(
        records.filter((r) => r.level === level),
        a.baseline.levels[level],
      );
      if (baseline) a.baseline.levels[level] = baseline;
    }
    if (
      context &&
      /^[a-f0-9]{64}$/.test(context.puzzleHash) &&
      !a.contexts.some((c) => c.date === context.date && c.level === context.level)
    )
      a.contexts.push(context);
    if (!Object.keys(a.baseline.levels).length && !a.contexts.length) return false;
    const text = JSON.stringify(a);
    if (text === stored) return false;
    localStorage.setItem(ANALYTICS_KEY, text);
    return true;
  } catch {
    return false;
  }
}
export async function ensurePerformance() {
  try {
    await withResultLock(() => {
      if (saveAnalyticsUnderLock(allResults())) notifyResults();
    });
  } catch {
    /* result APIs remain available */
  }
}
export function importAnalyticsUnderLock(
  candidate: unknown,
  records: AnchorRecord[],
): "imported" | "kept" | "rejected" | "failed" {
  const incoming = validateAnalytics(candidate, records);
  if (!incoming) {
    try {
      if (localStorage.getItem(ANALYTICS_KEY) === null)
        localStorage.setItem(ANALYTICS_KEY, JSON.stringify({ schemaVersion: 1, rejected: true }));
    } catch {
      return "failed";
    }
    return "rejected";
  }
  try {
    const prior = readAnalytics(records),
      stored = localStorage.getItem(ANALYTICS_KEY);
    if (stored !== null && !prior && JSON.parse(stored)?.rejected !== true) return "rejected";
    if (prior) {
      incoming.baseline.levels = { ...incoming.baseline.levels, ...prior.baseline.levels };
      const keys = new Set(prior.contexts.map((c) => `${c.date}:${c.level}`));
      incoming.contexts = [
        ...prior.contexts,
        ...incoming.contexts.filter((c) => !keys.has(`${c.date}:${c.level}`)),
      ];
    }
    const text = JSON.stringify(incoming);
    if (text === stored) return "kept";
    localStorage.setItem(ANALYTICS_KEY, text);
    return "imported";
  } catch {
    return "failed";
  }
}

export function analyticsBlocked() {
  try {
    return localStorage.getItem(ANALYTICS_KEY) !== null && !readAnalytics(allResults());
  } catch {
    return true;
  }
}
