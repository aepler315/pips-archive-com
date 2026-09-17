import type { ArchiveIndex, IndexLevel } from "./types";

function validDate(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
function validLevel(v: unknown): v is IndexLevel {
  if (!v || typeof v !== "object") return false;
  const level = v as IndexLevel;
  return (
    [level.rows, level.cols, level.cells, level.dominoes].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) && level.cells === level.dominoes * 2
  );
}
function validIndex(value: unknown): value is ArchiveIndex {
  if (!value || typeof value !== "object") return false;
  const index = value as ArchiveIndex;
  if (
    !Array.isArray(index.puzzles) ||
    !index.puzzles.length ||
    index.count !== index.puzzles.length
  )
    return false;
  return (
    index.puzzles.every(
      (p, i) =>
        p &&
        validDate(p.date) &&
        (i === 0 || index.puzzles[i - 1].date < p.date) &&
        p.levels &&
        ["easy", "medium", "hard"].every((l) => validLevel(p.levels[l as keyof typeof p.levels])),
    ) &&
    index.first === index.puzzles[0].date &&
    index.last === index.puzzles.at(-1)!.date
  );
}

export function archiveIsBehind(index: ArchiveIndex, now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return index.last < `${part("year")}-${part("month")}-${part("day")}`;
}

/** A failed refresh keeps the last good index, including during deployment. */
export function createArchiveStore(
  initial: ArchiveIndex,
  request: typeof fetch = (...args) => fetch(...args),
) {
  let current = initial;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => current,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh(): Promise<void> {
      if (pending) return pending;
      pending = (async () => {
        try {
          const response = await request("/data/index.json", {
            cache: "no-cache",
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) return;
          const next: unknown = await response.json();
          if (
            !validIndex(next) ||
            next.last < current.last ||
            JSON.stringify(next) === JSON.stringify(current)
          )
            return;
          current = next;
          listeners.forEach((listener) => listener());
        } catch {
          /* Retain the usable archive when offline or an update is incomplete. */
        }
      })().finally(() => {
        pending = null;
      });
      return pending;
    },
  };
}
