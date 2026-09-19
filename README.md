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
- `src/data/archive.json` – the initial archive index bundled into the client build. Open tabs revalidate
  `/data/index.json` on focus and while waiting for the next New York puzzle day. Kept in lockstep
  with `data/index.json` by `scripts/lib.mjs`'s `buildIndex()` — never hand-edited.
- `data/puzzles/YYYY-MM-DD.json` – raw NYT daily payload (all three difficulties + embedded
  solution), unmodified. `data/index.json` – the same listing, generated.
- `js/engine.js` – a second, independent implementation of the puzzle logic used **only** to
  validate incoming NYT payloads in `scripts/lib.mjs` before they're committed. It intentionally
  doesn't share code with `src/lib/pips/engine.ts`; keep the two in sync by hand if you change
  either one's notion of a valid puzzle.
- `scripts/fetch.mjs` – fill missing dates through today (New York), retry with request deadlines,
  validate, and write only changed data. `scripts/import.mjs` – ingest a folder
  of payloads. `scripts/build-index.mjs` – regenerate both index files.
- `scripts/sync-public-data.mjs` – mirrors `data/puzzles/` into `public/data/` so the client
  build and the test suite can read puzzle JSON the same way the browser will. Generated; not
  committed. Runs automatically before `dev`, `build`, and `test`.
- `test/engine.test.mjs` – validates the whole corpus against `js/engine.js` (every embedded
  solution must solve). `src/lib/pips/engine.test.ts` – unit tests for the shipping engine.
- `.github/workflows/daily.yml` – timezone-aware cron that catches up missing puzzles and commits
  changed data. Because GitHub schedules are best-effort, it retries every five minutes for the
  first two hours after New York midnight, then hourly; late runners still catch up.
- `.github/workflows/ci.yml` – typecheck, lint, test and build on every push and PR.
- `.github/workflows/deploy.yml` – reusable Pages build/deploy workflow, called after changed
  puzzle data, on pushes to `main`, or manually.

## Commands

    npm run dev                            # http://localhost:8080
    npm run backfill                       # launch date .. today, skipping dates already present
    npm run fetch                          # catch up missing archived dates through today
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
confirm NYT serves GitHub's runners. The daily workflow calls the reusable deployment workflow
only after it commits changed data (bot pushes alone do not trigger push workflows). An unchanged
fetch leaves both index timestamps intact and skips deployment. Failed requests, including range
backfills, leave the workflow red, while successfully validated additions are committed and deployed. Schedules are best-effort: GitHub can delay or drop runs, so exact midnight publication is not
guaranteed. Dense retries through 1:59 a.m. New York time bound the normal retry gap to five minutes
when at least one scheduled event is delivered. The default fetch fills gaps between the first archived date and
today; `--all` also fills any dates missing before the first archived file.

### Recorded times and daily results

Your first successfully saved completion time for each date and difficulty is permanent in this browser. Faster and slower replays are practice; clearing the board does not remove the recorded time. Archive and statistics screens use that first time, including older backups that also contain a faster `best` value.

Completing a date’s third puzzle opens its daily results card once. Click the date heading on a puzzle you have already completed to reopen it, including archived dates. A partially completed day shows saved times and “Not solved” for the rest; PNG download works, and Share becomes available after all three are recorded.

Stapipstics combine your recorded times with the actual dominoes in those three puzzles. The pool includes pip frequency, missing pip values, odd/even balance, repeated domino pairs, consecutive halves, the heaviest dominoes, region-rule mix, unrestricted cells, and solve-time rates. Each card picks up to three distinct subjects deterministically, so similar facts do not crowd each other out. They do not measure moves, mistakes, thinking speed, or performance against other players.

Download PNG exports the full card at 2× resolution, without the controls or surrounding board. Share copies exactly:

```text
Pips 09/19/2026
Easy: 01:02
Medium: 02:05
Hard: 04:05
```

Minutes do not wrap at an hour. If clipboard access is blocked, the same text appears for manual copying. If a completion cannot be safely saved, its attempt time stays frozen and Retry save uses that time. Keep that tab open until saving succeeds.

Result writes, imports, and confirmed erasure use the browser’s Web Locks API. Saving requires a secure context (HTTPS or localhost) and Web Locks support; an unavailable lock does not trigger an unsafe fallback. Existing records remain readable. Imported backups fill missing results and keep existing local results unchanged, even when the backup is faster or older. Reload older open tabs before importing after this upgrade so they use the same rules. Corrupt stored entries are preserved and reported as save failures.

These records are browser-local. Clearing site data, deliberate erasure, changing browsers without importing a backup, or manually editing storage can remove them. Export backups before erasing data.

### Browser regression checks

After `npm ci` and `npm run build`, install browsers with `npx playwright install --with-deps chromium firefox webkit`, then run `npm run test:browser`. The suite starts a loopback production preview, checks all three engines, tests real same-origin storage races, and validates downloaded PNG bytes and full dimensions. Screenshots and images are written to `.superpowers/browser-artifacts/` for visual review. Missing browser binaries fail explicitly.

The daily card always shows each difficulty’s share of that day’s total time and its average first-solve time across all saved puzzle dates, with a sample count. Replays and best times do not affect the average. Missing averages and incomplete or zero-total shares show a dash. Saved-result changes refresh these metrics, and PNG exports include the same values.

`evaluateStapipstics` evaluates all 37 registered candidates and returns each result (or null), a bounded score, selected status, and a reason for inclusion or exclusion. Editorial scores use the actual pip proportions, repeated pairs, extremes, rule variety, and rates; they are not population percentiles. The highest-scoring three distinct subjects are shown, with catalog order breaking ties. Hard’s time share is excluded because it is already permanent. Add new candidates together with a score rule and regression coverage.

The expanded pool adds personal baselines, podium finishes, clean sweeps, seven-solve trends, close finishes, difficulty reversals, clustered times, time ratios, and one-difficulty majorities. Puzzle facts also cover odd/even pip totals, disproportionate pip shares, dominant doubles, full pip-value sets, singleton/shared/exclusive pairs, extreme halves, seven-pip totals, rule density, unrestricted-region size, single-cell rules, and overlapping pieces with contrasting times.

Historical candidates use valid, unique first solves on puzzle dates strictly before the displayed date. Against your usual, Personal podium, and Clean sweep require at least five prior results per relevant difficulty; Moving average compares the latest seven prior results with the seven before them. Rank ties are explicit. Zero baselines cannot produce percentage comparisons. Historical facts show their sample sizes; permanent panel averages still include all saved dates.

Editorial eligibility thresholds keep routine outcomes from displacing useful facts: Photo finish means at most five seconds or 5% apart; Steady hands means a spread no greater than 20% of the slowest time; time ratios start at 2×; Same pieces, different story needs at least 50% shared distinct pairs (intersection/union) and a time gap of at least 20% of the slower result. Exact ties, reversals, personal milestones, and large baseline changes score above routine counts. No random reroll or population-performance claim is involved.
