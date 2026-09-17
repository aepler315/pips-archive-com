// Fetch and validate missing puzzles; safe to rerun after a delayed schedule.
// Default: fill gaps in the archive through today in America/New_York.
// Explicit dates select an inclusive range. --all starts at launch; --force overwrites.
import {
  dateRange,
  savePayload,
  buildIndex,
  listDates,
  todayNY,
  isoDate,
  LAUNCH_DATE,
  isDate,
} from "./lib.mjs";

const args = process.argv.slice(2).filter(Boolean);
const force = args.includes("--force"),
  all = args.includes("--all");
const dates = args.filter((a) => !["--force", "--all"].includes(a));
const today = isoDate(todayNY());
const have = new Set(listDates());
let from = dates[0] ?? [...have][0] ?? LAUNCH_DATE;
let to = dates[1] ?? (dates.length ? from : today);
if (all) {
  from = LAUNCH_DATE;
  to = today;
}
if (
  dates.length > 2 ||
  dates.some((d) => !isDate(d)) ||
  (all && dates.length) ||
  from > to ||
  from < LAUNCH_DATE ||
  to > today
) {
  console.error("Use valid dates from launch through today, in ascending order, or --all.");
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let added = 0,
  failed = 0;
for (const date of dateRange(from, to)) {
  if (have.has(date) && !force) continue;
  const url = `https://www.nytimes.com/svc/pips/v1/${date}.json`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`HTTP ${res.status}`);
      }
      const raw = await res.json();
      if (raw.printDate !== date) throw new Error(`printDate ${raw.printDate} != ${date}`);
      if (savePayload(raw, { overwrite: force })) {
        added++;
        console.log("saved", date);
      }
      have.add(date);
      break;
    } catch (e) {
      console.error(`Attempt ${attempt}/3 for ${date}: ${e.message}`);
      if (attempt === 3) failed++;
      else await sleep(1000 * 2 ** (attempt - 1));
    }
  }
  await sleep(400);
}
const idx = buildIndex();
console.log(
  `added ${added}, failed ${failed}, index now ${idx.count} dates (${idx.first} .. ${idx.last})`,
);
if (failed) process.exitCode = 1;
