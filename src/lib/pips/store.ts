import { adjacent, key, type GameState, type Level, type Puzzle } from "./engine";

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
  if (!s) return false;
  try {
    s.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
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

export const getResult = (date: string, level: Level) =>
  normalizeResult(read(resultKey(date, level)));
export function getProgress(date: string, level: Level, puzzle?: Puzzle): Progress | null {
  const value = read<Progress>(progressKey(date, level));
  if (!isValidProgress(value)) return null;
  if (
    puzzle &&
    (value.state.length !== puzzle.dominoes.length ||
      value.state.some((placement) =>
        placement?.cells.some((cell) => !puzzle.cells.has(key(...cell))),
      ))
  )
    return null;
  return value;
}

export function saveProgress(date: string, level: Level, state: GameState, elapsed: number) {
  return write(progressKey(date, level), { state, elapsed });
}
export function clearProgress(date: string, level: Level) {
  remove(progressKey(date, level));
}

export function recordSolve(date: string, level: Level, ms: number): Result & { saved: boolean } {
  const prev = getResult(date, level);
  const now = new Date().toISOString();
  const next: Result = prev
    ? { ...prev, best: Math.min(prev.best, ms), plays: prev.plays + 1, lastAt: now }
    : { first: ms, best: ms, solvedAt: now, lastAt: now, plays: 1 };
  const saved = write(resultKey(date, level), next);
  if (saved) clearProgress(date, level);
  return { ...next, saved };
}

export function allResults(): (Result & { date: string; level: Level })[] {
  const s = storage();
  if (!s) return [];
  const out: (Result & { date: string; level: Level })[] = [];
  for (const k of storageKeys(s)) {
    const parsed = parseKey(k);
    if (parsed?.kind !== "result") continue;
    const v = normalizeResult(read(k));
    if (v) out.push({ ...v, date: parsed.date, level: parsed.level });
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

function storageKeys(s: Storage): string[] {
  try {
    return Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => !!k);
  } catch {
    return [];
  }
}

function parseKey(k: string): { kind: "result" | "progress"; date: string; level: Level } | null {
  const match = /^pips-archive:v1:(result|progress):(\d{4}-\d{2}-\d{2}):(easy|medium|hard)$/.exec(
    k,
  );
  if (
    !match ||
    !Number.isFinite(Date.parse(match[2])) ||
    new Date(match[2]).toISOString().slice(0, 10) !== match[2]
  )
    return null;
  return { kind: match[1] as "result" | "progress", date: match[2], level: match[3] as Level };
}
const duration = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const timestamp = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 19) === v.slice(0, 19);

function normalizeResult(v: unknown): Result | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Result;
  if (
    !duration(r.first) ||
    !duration(r.best) ||
    r.best > r.first ||
    !Number.isSafeInteger(r.plays) ||
    r.plays < 1 ||
    !timestamp(r.solvedAt) ||
    !timestamp(r.lastAt) ||
    Date.parse(r.solvedAt) > Date.parse(r.lastAt)
  )
    return null;
  return {
    first: r.first,
    best: r.best,
    plays: r.plays,
    solvedAt: new Date(r.solvedAt).toISOString(),
    lastAt: new Date(r.lastAt).toISOString(),
  };
}

function isCell(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && v.every((n) => Number.isSafeInteger(n) && n >= 0);
}

function isValidProgress(v: unknown): v is Progress {
  if (!v || typeof v !== "object") return false;
  const p = v as Progress;
  if (!duration(p.elapsed) || !Array.isArray(p.state)) return false;
  const occupied = new Set<string>();
  return p.state.every((placement) => {
    if (placement === null) return true;
    if (
      !placement ||
      !Array.isArray(placement.cells) ||
      placement.cells.length !== 2 ||
      !placement.cells.every(isCell) ||
      !adjacent(...placement.cells)
    )
      return false;
    for (const cell of placement.cells) {
      const id = key(...cell);
      if (occupied.has(id)) return false;
      occupied.add(id);
    }
    return true;
  });
}

export function importAll(text: string): {
  imported: number;
  progress: number;
  skipped: number;
  failed: number;
} {
  const obj = JSON.parse(text) as { version?: number; data?: Record<string, unknown> };
  if (obj?.version !== 1 || !obj.data || typeof obj.data !== "object" || Array.isArray(obj.data))
    throw new Error("Not a Pips Archive export");
  let imported = 0,
    progress = 0,
    skipped = 0,
    failed = 0;
  for (const [k, v] of Object.entries(obj.data)) {
    const parsed = parseKey(k);
    if (!parsed) {
      skipped++;
      continue;
    }
    if (parsed.kind === "progress") {
      if (!isValidProgress(v)) {
        skipped++;
        continue;
      }
      const value: Progress = {
        elapsed: v.elapsed,
        state: v.state.map((p) => (p ? { cells: p.cells } : null)),
      };
      if (write(k, value)) progress++;
      else failed++;
      continue;
    }
    const result = normalizeResult(v);
    if (!result) {
      skipped++;
      continue;
    }
    const cur = normalizeResult(read(k));
    const merged = cur
      ? {
          first: cur.solvedAt <= result.solvedAt ? cur.first : result.first,
          best: Math.min(cur.best, result.best),
          solvedAt: cur.solvedAt < result.solvedAt ? cur.solvedAt : result.solvedAt,
          lastAt: cur.lastAt > result.lastAt ? cur.lastAt : result.lastAt,
          plays: Math.max(cur.plays, result.plays),
        }
      : result;
    if (write(k, merged)) imported++;
    else failed++;
  }
  return { imported, progress, skipped, failed };
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
