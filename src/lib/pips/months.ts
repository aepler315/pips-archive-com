import type { Level } from "./engine";
import type { IndexEntry } from "./types";

export type MonthGroup = { month: string; days: IndexEntry[] };

/** Newest month first. */
export function groupMonths(puzzles: IndexEntry[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let cur = "";
  for (const p of puzzles) {
    const m = p.date.slice(0, 7);
    if (m !== cur) {
      cur = m;
      groups.push({ month: m, days: [] });
    }
    groups[groups.length - 1].days.push(p);
  }
  return groups;
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function monthChip(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const parts = new Date(y, m - 1, 1)
    .toLocaleDateString(undefined, { month: "short", year: "2-digit" })
    .split(" ");
  // "Sep 26" reads as a day of the month; "Sep '26" reads as a year.
  return parts.length === 2 ? `${parts[0]} '${parts[1]}` : parts.join(" ");
}

export function resolveMonth(groups: MonthGroup[], requested?: string) {
  if (requested && groups.some((g) => g.month === requested)) return requested;
  return groups[0]?.month ?? "";
}

/**
 * Progression after solving a puzzle: easy -> medium -> hard of the same
 * day, then hard -> easy of the next archived day. `puzzles` must be sorted
 * oldest-first (the order archive.json stores them in).
 */
export function nextPuzzleTarget(
  puzzles: IndexEntry[],
  date: string,
  level: Level,
): { date: string; level: Level } | null {
  if (level === "easy") return { date, level: "medium" };
  if (level === "medium") return { date, level: "hard" };
  const i = puzzles.findIndex((p) => p.date === date);
  const next = i >= 0 ? puzzles[i + 1] : undefined;
  return next ? { date: next.date, level: "easy" } : null;
}
