# Winning arrangements and performance implementation

Base: `c475120092d4dd99f685452d12a6122a9e7f86d7`.
Recovered foundation commits: `71166ab`, `2403aa2`, `7dcc89a`.

| Plan tasks | Implementation |
|---|---|
| 1–2 | Independent tiling/assignment test oracle, normalized tile multiplicities, bigint bounded counter, geometric denominator, canonical hash; small-board oracle comparisons and September 19 regression |
| 3 | Atomic versioned sidecars, bounded retries retaining strongest evidence, stale discovery, trusted-main independent workflow, current-main reusable deployment, stratified benchmark |
| 4 | Validated async metadata loader, explicit pinned fact, partial-day spoiler suppression, unavailable status, frozen PNG display snapshot |
| 5 | Eight independent seeded first-solution traces, frozen 90-puzzle manifest and experimental percentile |
| 6 | Immutable level anchors, equal-band geometric performance, shared storage lock, optional validated analytics backups, erase integration, solve-time puzzle hashes |
| 7 | Calibration states, per-level windows/date spans, actual-completion timeline, browser regression scenarios and screenshots in CI |
| 8 | Local regularized log-time evaluation harness, chronological holdout, training-only normalization, eligibility/promotion checks; no automatic model activation |

## Measured coverage

398 dates / 1,194 puzzles: 1,191 exact winning counts, three bounded, zero invalid.
Structural traces: 1,193 complete, one bounded. The 90-puzzle frozen reference has
90 exact counts and 90 complete eight-trace profiles. September 19 counts are
Easy 3, Medium 1, Hard 2; unconstrained counts are 3,840; 5,160,960;
42,849,873,690,624,000.

The initial 90-puzzle run took 3.033 seconds; max process RSS was 134,136 KiB.
Worst puzzle total analysis time was 416 ms. Default searches were tuned to
50,000 nodes / 25,000 memo entries / 3,000 ms. The machine-readable benchmark
contains current rerun timings, all corpus hashes, outcomes and trace statistics.
Timings are machine-specific; solver-work percentiles do not use them.

## Verification and limits

Local typecheck passed. Unit suites passed: 21 JavaScript tests and 122 TypeScript
tests. Lint passed with four pre-existing React fast-refresh warnings.
Full production prerendering passed using a temporary local-only loopback bind
configuration; the unchanged default build encountered this container's unsupported
network-interface enumeration. No build workaround is shipped.

Local Playwright runs could not launch because browser executables were unavailable.
OS dependency installation is unsupported here and browser downloads timed out.
The PR CI runs the normal build and Chromium/Firefox/WebKit suites, including 320px
recaps, incomplete/unavailable analysis, calibration/form, cross-tab import/replay/
erase, plus the existing PNG, clipboard, focus, immutable-time and replay checks.
Browser screenshots are uploaded as `performance-browser-evidence`.

A fresh reviewer identified and verified fixes for rejected-import recalibration,
reference-manifest replacement without version changes, and future duplicate leakage
into calibration training. Regression tests reproduce all three.

No population ranking or validated human-difficulty model is claimed. The optional
future experiment remains inactive. Bounded results are proven lower bounds;
retries keep the strongest bound, never add overlapping runs. Calibration import
rejection preserves solve records and blocks silent replacement of the baseline.

## GitHub verification follow-up

PR #38 was merged before CI finished. PR #39 corrects a final calibration subtype
annotation and the cross-browser lifecycle failures discovered in the full suite.
GitHub run 35491905038 passed typecheck, lint, all 143 unit tests, the standard build,
and all 51 browser checks across Chromium, Firefox and WebKit. Its follow-up captures
full performance panels and resets focus suppression for each new solve attempt.
Screenshots are attached to the CI runs, including exact/incomplete recaps and
calibration/performance states. The separate analysis workflow also generated
September 20 metadata successfully on main.
