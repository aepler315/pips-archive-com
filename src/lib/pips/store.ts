import type { GameState, Level } from "./engine";

const P = "pips-archive:v1:";

export type Result = {
  first: number;
  best: number;
  solvedAt: string;
  lastAt: string;
  plays: number;
};

export type Progress = { state: GameState; elapsed: number };

const storage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage;
  } catch {
    return null;
  }
};

const read = <T>(k: string): T | null => {
  const s = storage();
  if (!s) return null;
  try {
    const v = s.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked (e.g. Safari Private Browsing): play on unsaved */
  }
};
const remove = (k: string) => {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(k);
  } catch {
    /* storage full or blocked */
  }
};

export const resultKey = (date: string, level: Level) => `${P}result:${date}:${level}`;
export const progressKey = (date: string, level: Level) => `${P}progress:${date}:${level}`;

export const getResult = (date: string, level: Level) => read<Result>(resultKey(date, level));
export const getProgress = (date: string, level: Level) =>
  read<Progress>(progressKey(date, level));

export function saveProgress(date: string, level: Level, state: GameState, elapsed: number) {
  write(progressKey(date, level), { state, elapsed });
}
export function clearProgress(date: string, level: Level) {
  remove(progressKey(date, level));
}

export function recordSolve(date: string, level: Level, ms: number): Result {
  const prev = getResult(date, level);
  const now = new Date().toISOString();
  const next: Result = prev
    ? { ...prev, best: Math.min(prev.best, ms), plays: prev.plays + 1, lastAt: now }
    : { first: ms, best: ms, solvedAt: now, lastAt: now, plays: 1 };
  write(resultKey(date, level), next);
  clearProgress(date, level);
  return next;
}

export function allResults(): (Result & { date: string; level: Level })[] {
  const s = storage();
  if (!s) return [];
  const out: (Result & { date: string; level: Level })[] = [];
  const prefix = `${P}result:`;
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k?.startsWith(prefix)) continue;
    const rest = k.slice(prefix.length);
    const cut = rest.lastIndexOf(":");
    const date = rest.slice(0, cut);
    const level = rest.slice(cut + 1) as Level;
    const v = read<Result>(k);
    if (v && date && level) out.push({ date, level, ...v });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function exportAll() {
  const s = storage();
  if (!s) return "{}";
  const data: Record<string, unknown> = {};
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k?.startsWith(P)) data[k] = read(k);
  }
  return JSON.stringify({ version: 1, exported: new Date().toISOString(), data }, null, 1);
}

function isValidResult(v: unknown): v is Result {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.first === "number" &&
    typeof r.best === "number" &&
    typeof r.plays === "number" &&
    r.plays >= 1 &&
    typeof r.solvedAt === "string" &&
    typeof r.lastAt === "string"
  );
}

function isCell(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number");
}

function isValidProgress(v: unknown): v is Progress {
  if (!v || typeof v !== "object") return false;
  const p = v as { state?: unknown; elapsed?: unknown };
  return (
    typeof p.elapsed === "number" &&
    p.elapsed >= 0 &&
    Array.isArray(p.state) &&
    p.state.every(
      (placement) =>
        placement === null ||
        (typeof placement === "object" &&
          placement !== null &&
          "cells" in placement &&
          Array.isArray(placement.cells) &&
          placement.cells.length === 2 &&
          placement.cells.every(isCell)),
    )
  );
}

export function importAll(text: string): { imported: number; progress: number; skipped: number } {
  const obj = JSON.parse(text) as { version?: number; data?: Record<string, unknown> };
  if (obj?.version !== 1 || !obj.data) throw new Error("Not a Pips Archive export");
  let imported = 0;
  let progress = 0;
  let skipped = 0;
  for (const [k, v] of Object.entries(obj.data)) {
    const isResult = k.startsWith(`${P}result:`);
    const isProgress = k.startsWith(`${P}progress:`);
    if (!isResult && !isProgress) continue;
    if (isProgress) {
      if (!isValidProgress(v)) {
        skipped++;
        continue;
      }
      write(k, v);
      progress++;
      continue;
    }
    if (!isValidResult(v)) {
      skipped++;
      continue;
    }
    const cur = read<Result>(k);
    write(
      k,
      cur
        ? {
            first: Math.min(cur.first, v.first),
            best: Math.min(cur.best, v.best),
            solvedAt: cur.solvedAt < v.solvedAt ? cur.solvedAt : v.solvedAt,
            lastAt: cur.lastAt > v.lastAt ? cur.lastAt : v.lastAt,
            // max, not sum: re-importing the same backup should be a no-op,
            // not double the recorded play count each time.
            plays: Math.max(cur.plays, v.plays),
          }
        : v,
    );
    imported++;
  }
  return { imported, progress, skipped };
}

export function eraseAll() {
  const s = storage();
  if (!s) return;
  const keys: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k?.startsWith(P)) keys.push(k);
  }
  keys.forEach(remove);
}

export function clockMs(accumulated: number, tickStart: number | null, now: number): number {
  return Math.round(accumulated + (tickStart == null ? 0 : now - tickStart));
}

export function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
