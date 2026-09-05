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
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function resolveMonth(groups: MonthGroup[], requested?: string) {
  if (requested && groups.some((g) => g.month === requested)) return requested;
  return groups[0]?.month ?? "";
}
