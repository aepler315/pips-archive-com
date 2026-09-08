# pipsarchive.com

Archive of NYT Pips puzzles, playable in the browser, with per-browser solve-time stats.
Built with TanStack Start, prerendered to static HTML, and hosted on GitHub Pages.
No backend, no accounts — everything a visitor does lives in their browser's localStorage.

## Layout
- `src/routes/` – the three pages: `index.tsx` (archive), `play.$date.$level.tsx` (the game),
  `stats.tsx`. `src/routes/__root.tsx` is the shared document shell.
- `src/components/pips-board.tsx`, `pips-tray.tsx` – the board (SVG) and domino tray.
- `src/lib/pips/engine.ts` – pure game logic (board, placement, snap, region evaluation, solve
  check). The type this whole app is built on; see its tests in `engine.test.ts`.
- `src/lib/pips/store.ts` – the localStorage layer (`pips-archive:v1:` prefix).
- `src/data/archive.json` – the archive index bundled into the client build. Kept in lockstep
  with `data/index.json` by `scripts/lib.mjs`'s `buildIndex()` — never hand-edited.
- `data/puzzles/YYYY-MM-DD.json` – raw NYT daily payload (all three difficulties + embedded
  solution), unmodified. `data/index.json` – the same listing, generated.
- `js/engine.js` – a second, independent implementation of the puzzle logic used **only** to
  validate incoming NYT payloads in `scripts/lib.mjs` before they're committed. It intentionally
  doesn't share code with `src/lib/pips/engine.ts`; keep the two in sync by hand if you change
  either one's notion of a valid puzzle.
- `scripts/fetch.mjs` – fetch from NYT, validate, write. `scripts/import.mjs` – ingest a folder
  of payloads. `scripts/build-index.mjs` – regenerate both index files.
- `scripts/sync-public-data.mjs` – mirrors `data/puzzles/` into `public/data/` so the client
  build and the test suite can read puzzle JSON the same way the browser will. Generated; not
  committed. Runs automatically before `dev`, `build`, and `test`.
- `test/engine.test.mjs` – validates the whole corpus against `js/engine.js` (every embedded
  solution must solve). `src/lib/pips/engine.test.ts` – unit tests for the shipping engine.
- `.github/workflows/daily.yml` – cron that fetches today's puzzle and commits it.
- `.github/workflows/ci.yml` – typecheck, lint, test and build on every push and PR.
- `.github/workflows/deploy.yml` – builds and publishes to GitHub Pages on every push to `main`.

## Commands
    npm run dev                            # http://localhost:8080
    npm run backfill                       # launch date .. today, skipping dates already present
    node scripts/fetch.mjs 2026-06-01 2026-08-31
    npm test
    npm run typecheck
    npm run lint
    npm run build                          # prerenders every puzzle to dist/client/

## Puzzle format notes
Board = union of `regions[].indices`; holes are simply absent. `solution[i]` is the cell pair for
`dominoes[i]`, first cell gets the first pip. Region types: `sum`, `less`, `greater` (all compare the
region's **sum** to `target`), `equals`, `unequal`, `empty` (no constraint).

## The site
- **Archive** (`/`) – month-grouped list of every date with easy/medium/hard chips showing your
  best time.
- **Play** (`/play/:date/:level`) – tap a tray domino, tap the cell for its first half, tap a
  neighbouring cell for the second; snap placement resolves the obvious case automatically. Tap a
  placed domino to select it, tap again to rotate, double-tap (within ~1/3s) to remove it. With a
  domino selected, `Tab` rotates and `Escape` clears the selection. The clock runs only while the
  tab is visible and stops on solve. Unfinished boards are saved and resume on return. The board
  draws each region as its own rounded polyomino — pastel fill, dashed outline, grout between
  neighbors, diamond badge on the inner corner — close to official Pips.
- **Stats** (`/stats`) – per-level counts, best/median/mean, recent solves, export/import/erase.

## Deploy
Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site (prerendering
every puzzle to a real static HTML file — no server, no adapter needed) and publishes
`dist/client/` to GitHub Pages via `actions/deploy-pages`.

One-time repo setup: **Settings → Pages → Build and deployment → Source → GitHub Actions** (not
"Deploy from a branch" — that would publish this README's source tree, not the built site).
`CNAME` is already `pipsarchive.com` and gets copied into the published output automatically;
point an A/ALIAS record at GitHub Pages. Run the "Fetch today's puzzle" workflow once by hand to
confirm NYT serves GitHub's runners — a puzzle-data commit to `main` also triggers a redeploy, so
the site picks up each day's new puzzle automatically once the cron lands it.
