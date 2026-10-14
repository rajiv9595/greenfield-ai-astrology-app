# Status

## Current task
CI gate robustness fix: missing-summary guard and skip-detection without name matching.

## State
Phase 3E is complete at the Vimshottari engine checkpoint `51cbdd7a1527eb3a35ffe824563136a84f88a77c`, and CI live-ephemeris provisioning was added at `d7de6389d1d4e3f862a24b908bdab33d77bf6bfe`. This follow-up hardens only the live-job assertion step: missing/unrecognized summaries now fail closed via explicit emptiness guards, and skip detection parses only summary fields (`N passed`, `N skipped`, `N failed`, `(total)`) instead of grepping the whole log for "skipped", so future test names containing "skip" cannot trip the gate. The step self-tests the gate on synthetic summaries (valid, skipped, failed, missing, malformed, skip-in-name) plus a direct call before checking the real output. Local execution of the step caught and fixed a real `pipefail -e` abort bug (empty `grep -oE` pipelines aborted before the explicit checks); extraction pipelines now end in `|| true` so the explicit guards govern in all call contexts. No calculation, provisioning, manifest, dependency, or remote changes. The recorded Phase 3D follow-ups and E2E browser setup remain open for later tasks.

## Commit

Starting checkpoint: `d7de6389d1d4e3f862a24b908bdab33d77bf6bfe`.

Phase 2 decision commit: `fdc7ac71fc9f866cda24fb07885d878ffc697d5f`.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed with pinned binary (8 files, 69 tests, 0 skipped): prior 53 tests unchanged plus 16 new Vimshottari tests (sequence table, all-9 lords, all-27 mapping, left-inclusive boundaries, hand-computed balances, MD order with exact 120-year cycle, hand-computed Venus-MD Antardashas, birth-active Antardasha with pre-birth chronology, half-open transitions, determinism, leap-day and year-boundary cases, D1 wiring, rejections).
- `npm run build` — passed.
- `npm run test:e2e` — NOT RUN; browser binaries have not been installed.
- CI hardening (uncommitted verification, same tree): offline `npm test -- --reporter=verbose` without ephemeris env gives 52 passed / 17 skipped (the 17 live-gated tests); live run with pinned binary gives 69 passed / 0 skipped. Remote CI has not run yet (no remote is configured); first real CI run must confirm both jobs green.
- CI gate fix (executed locally, same tree): the rewritten assertion step plus its embedded self-test were run under `bash -eo pipefail` against 7 synthetic cases (valid→pass; skipped/failed/missing/malformed→fail; skip-in-name→pass; direct call→pass), the real live output (69/69 clean summaries, exit 0), and the real offline output (fails with `not clean: Test Files  7 passed | 1 skipped (8)`, exit 1). This caught a genuine `pipefail -e` abort bug, now fixed. Workflow YAML re-validated by parse and `bash -n`.
- Local acceptance (uncommitted, provisional town-centre inputs): sidereal Ascendant Taurus 9°57′22.334″ (39.9562037675°), +0.0006″ vs the reviewed Step 1 nominal 39.956203597°; all grahas, houses, and measured retrograde sane; Rahu–Ketu exactly opposite. No personal birth details written to tracked files.

## Remaining risks
No production credentials, database, AI provider, or deployments are configured. The provider binary and ephemeris data are build-machine artifacts, not yet part of any deployment story; AGPL Corresponding Source and network-source availability remain open. D1 algorithm tolerance (arcseconds) is separate from birth time/coordinate uncertainty (arcminutes); pole latitudes rejected; host TZDB version unknowable via ECMAScript. CI live verification is newly configured but not yet observed on a real runner; E2E browsers still not installed.

## Next single action
Founder review of the CI gate fix. Remote CI remains NOT RUN (no remote configured). Do not begin another task before review.
