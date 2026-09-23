import {
  ANALYTICS_KEY,
  readAnalytics,
  saveAnalyticsUnderLock,
  importAnalyticsUnderLock,
} from "./performance-store";
import { formatResultDuration } from "./daily-results";
import { LEVELS, adjacent, key, type GameState, type Level, type Puzzle } from "./engine";
import {
  normalizeAssistance,
  validateImportedProgressHints,
  type AssistanceSnapshot,
  type HintReceipt,
  type PurchasedOffer,
} from "./hints";

const P = "pips-archive:v1:";

export type Result = {
  first: number;
  best: number;
  solvedAt: string;
  lastAt: string;
  plays: number;
  /** Hints paid for during the first solve. Absent on unassisted and legacy results. */
  assistance?: AssistanceSnapshot;
};

/** Hints bought during the unfinished attempt, kept so a reload cannot drop the penalty. */
export type ProgressHints = { receipts: HintReceipt[]; offers: PurchasedOffer[] };
export type Progress = { state: GameState; elapsed: number } & Partial<ProgressHints>;

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
  const raw = read<Progress>(progressKey(date, level));
  if (!isValidProgress(raw)) return null;
  const value: Progress = {
    state: raw.state,
    elapsed: raw.elapsed,
    ...progressHints(validateImportedProgressHints(raw) ?? undefined),
  };
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

export function saveProgress(
  date: string,
  level: Level,
  state: GameState,
  elapsed: number,
  hints?: ProgressHints,
) {
  return write(progressKey(date, level), { state, elapsed, ...progressHints(hints) });
}

function progressHints(hints: Partial<ProgressHints> | undefined): Partial<ProgressHints> {
  return hints && (hints.receipts?.length || hints.offers?.length)
    ? { receipts: hints.receipts ?? [], offers: hints.offers ?? [] }
    : {};
}
export function clearProgress(date: string, level: Level) {
  remove(progressKey(date, level));
}

export type SolveWrite =
  | { status: "created" | "existing"; result: Result; completedDay: boolean; reason?: never }
  | {
      status: "failed";
      result: null;
      completedDay: false;
      reason: "storage" | "invalid" | "corrupt" | "locking";
    };

const listeners = new Set<() => void>();
export function notifyResults() {
  for (const listener of listeners) {
    // A UI subscriber must never turn a committed save into a failed outcome.
    try {
      listener();
    } catch {
      /* independently owned listener */
    }
  }
}
export function subscribeResults(listener: () => void): () => void {
  listeners.add(listener);
  const changed = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(`${P}result:`) || event.key === ANALYTICS_KEY)
      listener();
  };
  if (typeof window !== "undefined") window.addEventListener?.("storage", changed);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener?.("storage", changed);
  };
}

export async function withResultLock<T>(run: () => T): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks?.request)
    throw new Error("Safe result saving requires Web Locks");
  return navigator.locks.request("pips-archive:results", async () => {
    // Cross-process storage snapshots can outlive the lock callback's microtask.
    // Read in a fresh task, then let writes flush before releasing the lock.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const result = run();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return result;
  });
}

// Unlike display reads, mutation reads must distinguish missing from corrupt/blocked.
function inspectResult(
  k: string,
): { kind: "missing" } | { kind: "existing"; result: Result } | { kind: "storage" | "corrupt" } {
  const s = storage();
  if (!s) return { kind: "storage" };
  try {
    const raw = s.getItem(k);
    if (raw === null) return { kind: "missing" };
    try {
      const result = normalizeResult(JSON.parse(raw));
      return result ? { kind: "existing", result } : { kind: "corrupt" };
    } catch {
      return { kind: "corrupt" };
    }
  } catch {
    return { kind: "storage" };
  }
}

export async function recordSolve(
  date: string,
  level: Level,
  ms: number,
  puzzleHash?: string,
  assistance?: AssistanceSnapshot | null,
): Promise<SolveWrite> {
  const failed = (reason: "storage" | "invalid" | "corrupt" | "locking"): SolveWrite => ({
    status: "failed",
    result: null,
    completedDay: false,
    reason,
  });
  if (!parseKey(resultKey(date, level)) || !duration(ms)) return failed("invalid");
  const assisted = assistance ? normalizeAssistance(assistance) : null;
  if (assistance && !assisted) return failed("invalid");
  // Freeze the completion timestamp before waiting for another tab's write.
  const now = new Date().toISOString();
  try {
    return await withResultLock(() => {
      const prev = inspectResult(resultKey(date, level));
      if (prev.kind === "storage" || prev.kind === "corrupt") return failed(prev.kind);
      if (prev.kind === "existing") {
        return { status: "existing", result: prev.result, completedDay: false };
      }
      const completedDay = LEVELS.filter((l) => l !== level).every(
        (l) => inspectResult(resultKey(date, l)).kind === "existing",
      );
      const result: Result = { first: ms, best: ms, solvedAt: now, lastAt: now, plays: 1 };
      if (assisted?.receipts.length) result.assistance = assisted;
      if (!write(resultKey(date, level), result)) return failed("storage");
      // Assisted solves never enter the performance model, so they carry no context.
      saveAnalyticsUnderLock(
        allResults(),
        puzzleHash && !result.assistance
          ? { date, level, first: ms, solvedAt: now, puzzleHash }
          : undefined,
      );
      notifyResults();
      return { status: "created", result, completedDay };
    });
  } catch {
    return failed("locking");
  }
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
    if (k?.startsWith(P) && k !== ANALYTICS_KEY) data[k] = read(k);
  }
  const analytics = readAnalytics(allResults());
  return JSON.stringify(
    { version: 1, exported: new Date().toISOString(), data, ...(analytics ? { analytics } : {}) },
    null,
    1,
  );
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
  // A damaged hint record must not quietly turn an assisted solve into a clean one.
  const assistance = r.assistance === undefined ? null : normalizeAssistance(r.assistance);
  if (r.assistance !== undefined && !assistance) return null;
  return {
    first: r.first,
    best: r.best,
    plays: r.plays,
    solvedAt: new Date(r.solvedAt).toISOString(),
    lastAt: new Date(r.lastAt).toISOString(),
    ...(assistance?.receipts.length ? { assistance } : {}),
  };
}

function isCell(v: unknown): v is [number, number] {
  return Array.isArray(v) && v.length === 2 && v.every((n) => Number.isSafeInteger(n) && n >= 0);
}

function isValidProgress(v: unknown): v is Progress {
  if (!v || typeof v !== "object") return false;
  const p = v as Progress;
  if (!duration(p.elapsed) || !Array.isArray(p.state)) return false;
  if (!validateImportedProgressHints(p)) return false;
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

export type ImportReport = {
  analytics?: "imported" | "kept" | "rejected" | "failed";
  imported: number;
  progress: number;
  unchanged: number;
  skipped: number;
  failed: number;
};
export async function importAll(text: string): Promise<ImportReport> {
  const obj = JSON.parse(text) as {
    version?: number;
    data?: Record<string, unknown>;
    analytics?: unknown;
  };
  if (obj?.version !== 1 || !obj.data || typeof obj.data !== "object" || Array.isArray(obj.data))
    throw new Error("Not a Pips Archive export");
  const entries = Object.entries(obj.data);
  return withResultLock(() => {
    const report: ImportReport = { imported: 0, progress: 0, unchanged: 0, skipped: 0, failed: 0 };
    for (const [k, v] of entries) {
      const parsed = parseKey(k);
      if (!parsed) {
        report.skipped++;
        continue;
      }
      if (parsed.kind === "progress") {
        if (!isValidProgress(v)) {
          report.skipped++;
          continue;
        }
        const value: Progress = {
          elapsed: v.elapsed,
          state: v.state.map((p) => (p ? { cells: p.cells } : null)),
          ...progressHints(validateImportedProgressHints(v) ?? undefined),
        };
        if (write(k, value)) report.progress++;
        else report.failed++;
        continue;
      }
      const result = normalizeResult(v);
      if (!result) {
        report.skipped++;
        continue;
      }
      const cur = inspectResult(k);
      if (cur.kind === "existing") {
        report.unchanged++;
        continue;
      }
      if (cur.kind !== "missing") {
        report.failed++;
        continue;
      }
      if (write(k, result)) report.imported++;
      else report.failed++;
    }
    if (obj.analytics !== undefined)
      report.analytics = importAnalyticsUnderLock(obj.analytics, allResults());
    if (report.imported || report.analytics === "imported") notifyResults();
    return report;
  });
}

export async function eraseAll(): Promise<{ erased: number; failed: number }> {
  try {
    return await withResultLock(() => {
      const s = storage();
      if (!s) return { erased: 0, failed: 1 };
      let erased = 0,
        failed = 0;
      try {
        const keys = Array.from({ length: s.length }, (_, i) => s.key(i));
        for (const k of keys) {
          if (!k?.startsWith(P)) continue;
          try {
            s.removeItem(k);
            erased++;
          } catch {
            failed++;
          }
        }
      } catch {
        failed++;
      }
      if (erased) notifyResults();
      return { erased, failed };
    });
  } catch {
    return { erased: 0, failed: 1 };
  }
}

export function clockMs(accumulated: number, tickStart: number | null, now: number): number {
  return Math.round(accumulated + (tickStart == null ? 0 : now - tickStart));
}

export const fmt = formatResultDuration;
