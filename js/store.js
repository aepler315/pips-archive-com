// All per-visitor data lives in localStorage under a versioned prefix.
//   pa1:result:<date>:<level>   { first, best, solvedAt, plays }   (ms)
//   pa1:progress:<date>:<level> { state, elapsed }                 (unsolved puzzle in flight)
const P = 'pa1:';

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const resultKey = (date, level) => `${P}result:${date}:${level}`;
export const progressKey = (date, level) => `${P}progress:${date}:${level}`;

export const getResult = (date, level) => read(resultKey(date, level));
export const getProgress = (date, level) => read(progressKey(date, level));

export function saveProgress(date, level, state, elapsed) {
  write(progressKey(date, level), { state, elapsed });
}
export function clearProgress(date, level) {
  localStorage.removeItem(progressKey(date, level));
}

export function recordSolve(date, level, ms) {
  const prev = getResult(date, level);
  const now = new Date().toISOString();
  const next = prev
    ? { ...prev, best: Math.min(prev.best, ms), plays: prev.plays + 1, lastAt: now }
    : { first: ms, best: ms, solvedAt: now, lastAt: now, plays: 1 };
  write(resultKey(date, level), next);
  clearProgress(date, level);
  return next;
}

export function allResults() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k.startsWith(P + 'result:')) continue;
    const [, , date, level] = k.split(':');
    out.push({ date, level, ...read(k) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function exportAll() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(P)) data[k] = read(k);
  }
  return JSON.stringify({ version: 1, exported: new Date().toISOString(), data }, null, 1);
}

// Merges: keeps the better `best`, earlier `first`, sums plays. Never deletes.
export function importAll(text) {
  const obj = JSON.parse(text);
  if (obj?.version !== 1 || !obj.data) throw new Error('Not a pipsarchive export');
  let n = 0;
  for (const [k, v] of Object.entries(obj.data)) {
    if (!k.startsWith(P + 'result:')) continue;
    const cur = read(k);
    write(k, cur ? { first: cur.first, best: Math.min(cur.best, v.best), solvedAt: cur.solvedAt < v.solvedAt ? cur.solvedAt : v.solvedAt,
                     lastAt: cur.lastAt > v.lastAt ? cur.lastAt : v.lastAt, plays: cur.plays + v.plays } : v);
    n++;
  }
  return n;
}

export function eraseAll() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(P)) keys.push(k); }
  keys.forEach((k) => localStorage.removeItem(k));
}

export function fmt(ms) {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(h ? 2 : 1, '0'), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
