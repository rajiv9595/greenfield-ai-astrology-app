# Status

## Current task
CI hardening: reproducible live ephemeris verification (audit finding E1).

## State
Phase 3E is complete at the Vimshottari engine checkpoint `51cbdd7a1527eb3a35ffe824563136a84f88a77c`. This hardening task adds a separate `live-ephemeris` CI job: it shallow-fetches the exact pinned upstream revision `aacf962d19d79f8bc921dbcdaacf306d85be1917`, verifies revision identity plus a clean tree, verifies all 262 `ephe/` files against the new SHA-256 manifest (`packages/swiss-ephemeris/ephe-sha256.txt`, generated from the Phase 3A 448/448 blob verification), builds `swetest` with the unmodified upstream Linux Makefile, and runs the full suite with `SWEPH_BIN`/`SWEPH_EPHE_PATH` set so all 17 live-gated tests execute; an assertion step fails the job on any skip. No calculation algorithms, tests, skip logic, or conventions changed. The recorded Phase 3D follow-ups (ayanamsha consolidation, stationary-retrograde documentation) and the E2E browser setup remain open for later tasks.

## Commit

Starting checkpoint: `51cbdd7a1527eb3a35ffe824563136a84f88a77c`.

Phase 2 decision commit: `fdc7ac71fc9f866cda24fb07885d878ffc697d5f`.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed with pinned binary (8 files, 69 tests, 0 skipped): prior 53 tests unchanged plus 16 new Vimshottari tests (sequence table, all-9 lords, all-27 mapping, left-inclusive boundaries, hand-computed balances, MD order with exact 120-year cycle, hand-computed Venus-MD Antardashas, birth-active Antardasha with pre-birth chronology, half-open transitions, determinism, leap-day and year-boundary cases, D1 wiring, rejections).
- `npm run build` — passed.
- `npm run test:e2e` — NOT RUN; browser binaries have not been installed.
- CI hardening (uncommitted verification, same tree): offline `npm test -- --reporter=verbose` without ephemeris env gives 52 passed / 17 skipped (the 17 live-gated tests); live run with pinned binary gives 69 passed / 0 skipped. The new `live-ephemeris` CI assertion logic was executed locally against both outputs: it passes the live output and fails the skipped output, so a green live job cannot hide skips. Remote CI has not run yet (no runner access from here); first real CI run must confirm both jobs green.
- Local acceptance (uncommitted, provisional town-centre inputs): sidereal Ascendant Taurus 9°57′22.334″ (39.9562037675°), +0.0006″ vs the reviewed Step 1 nominal 39.956203597°; all grahas, houses, and measured retrograde sane; Rahu–Ketu exactly opposite. No personal birth details written to tracked files.

## Remaining risks
No production credentials, database, AI provider, or deployments are configured. The provider binary and ephemeris data are build-machine artifacts, not yet part of any deployment story; AGPL Corresponding Source and network-source availability remain open. D1 algorithm tolerance (arcseconds) is separate from birth time/coordinate uncertainty (arcminutes); pole latitudes rejected; host TZDB version unknowable via ECMAScript. CI live verification is newly configured but not yet observed on a real runner; E2E browsers still not installed.

## Next single action
Founder review of the CI hardening. Do not begin another task before review.
