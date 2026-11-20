# Pips Archive Android

Approved in chat on 2026-10-14. User authorized Capacitor, normal timing, no hint penalties or scoring disadvantages, an installable APK, and continuous execution without further design approvals.

Bundle the existing React/TanStack game and complete checked-in puzzle archive in a Capacitor Android app. Keep puzzle controls, saved progress, daily results and statistics. All three hint tiers are free on first attempts and replays. Raw active play time is the only result time; imported historical assistance metadata is preserved and validated but never adds time or excludes a result from performance calculations. Do not require a server or network to launch or play bundled puzzles. Use an app-specific client entry/build so Android does not depend on TanStack server rendering. Bundle fonts for offline use.

Handle Android system Back, screen insets and app pause/resume. Provide native file sharing for results and backup exports if browser download cannot work in a WebView. Keep existing backup import. Produce a signed, sideloadable APK, document its signing/build details, and preserve the signing key outside Git for repeatable updates. No Play Store publication or merge is authorized.

Validation: regression tests for free hints, legacy results, score eligibility and analytics; full existing tests, typecheck, lint and web/Android builds; device/emulator install and launch if available, offline navigation, hint upgrades, solve/save/resume and Back. Clearly report any unavailable device evidence.
