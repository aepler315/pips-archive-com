import { scoredFirstMs } from "./hints";
import { LEVELS, type Level } from "./engine";
import type { Result } from "./store";

export type DayResults = {
  date: string;
  records: Record<Level, Result | null>;
  solvedCount: number;
  complete: boolean;
  totalMs: number | null;
};
export function validResultDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}
export function buildDailyResults(date: string, records: Record<Level, Result | null>): DayResults {
  if (!validResultDate(date)) throw new Error("Invalid puzzle date");
  const safe = Object.fromEntries(
    LEVELS.map((l) => [
      l,
      records[l] && Number.isFinite(records[l].first) && records[l].first >= 0 ? records[l] : null,
    ]),
  ) as Record<Level, Result | null>;
  const solvedCount = LEVELS.filter((l) => safe[l] !== null).length;
  const total = LEVELS.reduce((n, l) => n + (safe[l] ? scoredFirstMs(safe[l]) : 0), 0);
  return {
    date,
    records: safe,
    solvedCount,
    complete: solvedCount === 3,
    totalMs: solvedCount === 3 && Number.isFinite(total) ? total : null,
  };
}
export function formatResultDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) throw new Error("Invalid duration");
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
/** Signed gap against an average, e.g. `−00:47`, `+01:12`, `even`. Uses a real
 *  minus sign so it lines up with the plus at the same tabular width. */
export function formatResultDelta(ms: number): string {
  if (!Number.isFinite(ms)) throw new Error("Invalid duration");
  if (Math.abs(ms) < 1000) return "even";
  return `${ms < 0 ? "−" : "+"}${formatResultDuration(Math.abs(ms))}`;
}
export function formatResultDate(date: string): string {
  if (!validResultDate(date)) throw new Error("Invalid puzzle date");
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}
