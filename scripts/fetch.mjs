// Fetch puzzles from NYT and store them. Skips dates already present.
//   node scripts/fetch.mjs                 -> today (America/New_York)
//   node scripts/fetch.mjs 2026-06-01      -> one date
//   node scripts/fetch.mjs 2026-06-01 2026-08-31   -> inclusive range
//   --force  overwrite existing files      --all  launch date .. today
import { dateRange, savePayload, buildIndex, listDates, todayNY, isoDate, LAUNCH_DATE } from './lib.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force'), all = args.includes('--all');
const dates = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const today = isoDate(todayNY());
let from = dates[0] ?? today, to = dates[1] ?? from;
if (all) { from = LAUNCH_DATE; to = today; }

const have = new Set(listDates());
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
let added = 0, failed = 0;
for (const date of dateRange(from, to)) {
  if (have.has(date) && !force) continue;
  const url = `https://www.nytimes.com/svc/pips/v1/${date}.json`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trimStart().startsWith('{')) throw new Error('non-JSON body');
    const raw = JSON.parse(text);
    if (raw.printDate !== date) throw new Error(`printDate ${raw.printDate} != ${date}`);
    if (savePayload(raw, { overwrite: force })) { added++; console.log('saved', date); }
  } catch (e) {
    failed++; console.error('FAIL', date, e.message);
  }
  await new Promise((r) => setTimeout(r, 400)); // be polite
}
const idx = buildIndex();
console.log(`added ${added}, failed ${failed}, index now ${idx.count} dates (${idx.first} .. ${idx.last})`);
if (failed && !all && dates.length <= 1) process.exit(1); // single-date runs (the daily Action) must fail loudly
