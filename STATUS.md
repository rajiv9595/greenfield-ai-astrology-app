# Status

## Current task
Fix invalid `runner` context in the live CI job (first remote run failed validation).

## State
Phase 3E, CI provisioning (`d7de638`), and the CI gate fix (`4e3e5c6`) are complete. The first real GitHub Actions run failed before jobs started: job-level `env:` does not accept the `runner` context (`ci.yml` lines 33–34). This follow-up removes the invalid job-level `SWEPH_BIN`/`SWEPH_EPHE_PATH` expressions and adds an early `Export live ephemeris paths` step that writes both values from the runner-provided `$RUNNER_TEMP` into `$GITHUB_ENV` before provisioning and tests; all shell temporary paths now use `$RUNNER_TEMP` consistently, with no machine-specific paths. Provisioning, revision/version checks, the summary parser, its self-tests, skip/fail strictness, and the offline job are unchanged.

## Commit

Starting checkpoint: `4e3e5c6dd892a18d0c5443d994ac7c10feac8da7`.

Phase 2 decision commit: `fdc7ac71fc9f866cda24fb07885d878ffc697d5f`.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed with pinned binary (8 files, 69 tests, 0 skipped): prior 53 tests unchanged plus 16 new Vimshottari tests (sequence table, all-9 lords, all-27 mapping, left-inclusive boundaries, hand-computed balances, MD order with exact 120-year cycle, hand-computed Venus-MD Antardashas, birth-active Antardasha with pre-birth chronology, half-open transitions, determinism, leap-day and year-boundary cases, D1 wiring, rejections).
- `npm run build` — passed.
- `npm run test:e2e` — NOT RUN; browser binaries have not been installed.
- CI hardening (uncommitted verification, same tree): offline `npm test -- --reporter=verbose` without ephemeris env gives 52 passed / 17 skipped (the 17 live-gated tests); live run with pinned binary gives 69 passed / 0 skipped. Remote CI has not run yet (no remote is configured); first real CI run must confirm both jobs green.
- CI gate fix (executed locally, same tree): the rewritten assertion step plus its embedded self-test were run under `bash -eo pipefail` against 7 synthetic cases (valid→pass; skipped/failed/missing/malformed→fail; skip-in-name→pass; direct call→pass), the real live output (69/69 clean summaries, exit 0), and the real offline output (fails with `not clean: Test Files  7 passed | 1 skipped (8)`, exit 1). This caught a genuine `pipefail -e` abort bug, now fixed. Workflow YAML re-validated by parse and `bash -n`.
- Runner-context fix (executed locally, same tree): zero `runner` references remain in `ci.yml`; workflow YAML re-parsed (2 jobs, export step ordered before provision and tests); every step body passes `bash -n`; the export step was simulated (`RUNNER_TEMP` + `GITHUB_ENV` to temp files) and a downstream consumer receives both paths; the rewritten assert step was re-executed against the real live output (exit 0) and offline output (exit 1). `actionlint` is not installed here, so no actionlint run was performed. Remote CI rerun NOT RUN (no push yet).
- Local acceptance (uncommitted, provisional town-centre inputs): sidereal Ascendant Taurus 9°57′22.334″ (39.9562037675°), +0.0006″ vs the reviewed Step 1 nominal 39.956203597°; all grahas, houses, and measured retrograde sane; Rahu–Ketu exactly opposite. No personal birth details written to tracked files.

## Remaining risks
No production credentials, database, AI provider, or deployments are configured. The provider binary and ephemeris data are build-machine artifacts, not yet part of any deployment story; AGPL Corresponding Source and network-source availability remain open. D1 algorithm tolerance (arcseconds) is separate from birth time/coordinate uncertainty (arcminutes); pole latitudes rejected; host TZDB version unknowable via ECMAScript. CI live verification is newly configured but not yet observed on a real runner; the first remote run failed workflow validation before jobs started, and this fix is also unobserved remotely; E2E browsers still not installed.

## Next single action
Founder review of the runner-context fix (not pushed). Do not trigger another remote CI run before review.
