import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePayload, describe, LEVELS } from '../js/engine.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PUZZLE_DIR = join(ROOT, 'data', 'puzzles');
export const INDEX_PATH = join(ROOT, 'data', 'index.json');
export const LAUNCH_DATE = '2025-08-18';

export const isoDate = (d) => d.toISOString().slice(0, 10);
export const todayNY = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

export function* dateRange(from, to) {
  const d = new Date(from + 'T00:00:00Z'), end = new Date(to + 'T00:00:00Z');
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) yield isoDate(d);
}

// Validate and write one raw payload. Returns true if written.
export function savePayload(raw, { overwrite = false } = {}) {
  const problems = validatePayload(raw);
  if (problems.length) throw new Error(`${raw?.printDate}: ${problems.join('; ')}`);
  mkdirSync(PUZZLE_DIR, { recursive: true });
  const out = join(PUZZLE_DIR, `${raw.printDate}.json`);
  if (existsSync(out) && !overwrite) return false;
  writeFileSync(out, JSON.stringify(raw));
  return true;
}

export function listDates() {
  return readdirSync(PUZZLE_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(0, 10)).sort();
}

export function buildIndex() {
  const dates = listDates();
  const entries = dates.map((date) => {
    const raw = JSON.parse(readFileSync(join(PUZZLE_DIR, `${date}.json`), 'utf8'));
    const levels = {};
    for (const lvl of LEVELS) levels[lvl] = describe(raw, lvl);
    return { date, editor: raw.editor ?? null, levels };
  });
  const index = { generated: new Date().toISOString(), first: dates[0] ?? null,
                  last: dates.at(-1) ?? null, count: dates.length, puzzles: entries };
  writeFileSync(INDEX_PATH, JSON.stringify(index));
  return index;
}
