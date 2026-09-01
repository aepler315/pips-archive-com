# pipsarchive.com

Static archive of NYT Pips puzzles, playable in the browser, with per-browser solve-time stats.
Hosted on GitHub Pages. No backend, no accounts.

## Layout
- `js/engine.js` – pure game logic (board, placement, region evaluation, solve check). Shared by the site and the scripts.
- `data/puzzles/YYYY-MM-DD.json` – raw NYT daily payload (all three difficulties + embedded solution), unmodified.
- `data/index.json` – generated listing the archive page loads (one entry per date).
- `scripts/fetch.mjs` – fetch from NYT, validate, write. `scripts/import.mjs` – ingest a folder of payloads. `scripts/build-index.mjs` – regenerate the index.
- `test/` – engine tests run against the whole corpus (every embedded solution must solve).
- `.github/workflows/daily.yml` – cron that fetches today's puzzle and commits it.

## Commands
    npm run backfill                       # launch date .. today, skipping dates already present
    node scripts/fetch.mjs 2026-06-01 2026-08-31
    npm test
    npm run serve                          # local preview at http://localhost:8000

## Puzzle format notes
Board = union of `regions[].indices`; holes are simply absent. `solution[i]` is the cell pair for
`dominoes[i]`, first cell gets the first pip. Region types: `sum`, `less`, `greater` (all compare the
region's **sum** to `target`), `equals`, `unequal`, `empty` (no constraint).

## Site
- `index.html` + `js/archive.js` – month-grouped list of every date with E/M/H chips showing your best time.
- `play.html` + `js/play.js` + `js/render.js` – the game. Tap a tray domino, tap the cell for its first half, tap a neighbouring cell for the second. Tap a placed domino to select it; tap again to flip, or return it to the tray. Clock runs only while the tab is visible and stops on solve. Unfinished boards are saved and resume on return. The board is a single rounded polyomino (colored regions, diamond badges at the south-east cell of each constraint) rather than per-cell outlines.
- `stats.html` + `js/stats.js` – per-level counts, best/median/mean, recent solves, export/import/erase.
- `js/store.js` – localStorage layer (`pa1:` prefix). Replaying a solved puzzle keeps `first` and updates `best`.

## Deploy
Push to GitHub, Settings → Pages → deploy from `main` / root. `CNAME` is already `pipsarchive.com`; point an A/ALIAS record at GitHub Pages. Run the "Fetch today's puzzle" workflow once by hand to confirm NYT serves GitHub's runners.
