# Status

## Current task
Hardening: consolidate the duplicated ayanamsha/nutation implementations.

## State
Prior work complete through the CI runner-context fix (`445d1f1`, pushed to `origin/main`). This hardening task retires the duplicated test-support ayanamsha implementation (`tests/unit/ayanamsha-theory.ts`) and nutation table (`tests/unit/ayanamsha-nut2000b.ts`): `packages/astrology-core/src/ayanamsha.ts` and `src/nutation-iau2000b.ts` are now the single canonical sources (no production imports from `tests/`, no algorithm or convention changes — the two copies were arithmetically identical). Independent accuracy is preserved and now validates production directly: the Phase 3C L0–L4 tests still assert against published polynomials/spot values, the pinned binary (MEAN/TRUE/nutation transcription), and the five printed literature anchors with unchanged tolerances; reference epochs, ΔT values, anchors, and tolerances are byte-preserved in `ayanamsha-anchors.ts`, which additionally hosts the moved upstream-header reference decimal with provenance. The only deleted assertions are the two self-declared non-independent copy-fidelity tests. Remaining test-only code is labeled where it lives: the `julianDayTT` calendar helper in the first-principles test file and the header-decimal reference in the anchors file. Out of scope and untouched: obliquity/JD-constant/V1-gate/parser/ΔT/retrograde/E2E/CI items remain tracked separately.

## Commit

Starting checkpoint: `445d1f1191c299fea3854959c53ee20c5a369b39`.

Phase 2 decision commit: `fdc7ac71fc9f866cda24fb07885d878ffc697d5f`.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed with pinned binary (8 files, 67 tests, 0 skipped): prior suite minus the 2 retired non-independent copy-fidelity tests; all Phase 3C L0–L4 accuracy tests pass against the consolidated production module (MEAN/TRUE ≤0.29", nutation transcription, 5 literature anchors), plus all D1, Dasha, adapter, and reference tests unchanged.
- `npm run build` — passed.
- `npm run test:e2e` — NOT RUN; browser binaries have not been installed.
- CI hardening (uncommitted verification, same tree): offline `npm test -- --reporter=verbose` without ephemeris env gives 52 passed / 17 skipped (the 17 live-gated tests); live run with pinned binary gives 69 passed / 0 skipped. Remote CI has not run yet (no remote is configured); first real CI run must confirm both jobs green.
- CI gate fix (executed locally, same tree): the rewritten assertion step plus its embedded self-test were run under `bash -eo pipefail` against 7 synthetic cases (valid→pass; skipped/failed/missing/malformed→fail; skip-in-name→pass; direct call→pass), the real live output (69/69 clean summaries, exit 0), and the real offline output (fails with `not clean: Test Files  7 passed | 1 skipped (8)`, exit 1). This caught a genuine `pipefail -e` abort bug, now fixed. Workflow YAML re-validated by parse and `bash -n`.
- Runner-context fix (executed locally, same tree): zero `runner` references remain in `ci.yml`; workflow YAML re-parsed (2 jobs, export step ordered before provision and tests); every step body passes `bash -n`; the export step was simulated (`RUNNER_TEMP` + `GITHUB_ENV` to temp files) and a downstream consumer receives both paths; the rewritten assert step was re-executed against the real live output (exit 0) and offline output (exit 1). `actionlint` is not installed here, so no actionlint run was performed. Remote CI rerun NOT RUN (no push yet).
- Local acceptance (uncommitted, provisional town-centre inputs): sidereal Ascendant Taurus 9°57′22.334″ (39.9562037675°), +0.0006″ vs the reviewed Step 1 nominal 39.956203597°; all grahas, houses, and measured retrograde sane; Rahu–Ketu exactly opposite. No personal birth details written to tracked files.

## Remaining risks
No production credentials, database, AI provider, or deployments are configured. The provider binary and ephemeris data are build-machine artifacts, not yet part of any deployment story; AGPL Corresponding Source and network-source availability remain open. D1 algorithm tolerance (arcseconds) is separate from birth time/coordinate uncertainty (arcminutes); pole latitudes rejected; host TZDB version unknowable via ECMAScript. CI live verification is newly configured but not yet observed on a real runner; the first remote run failed workflow validation before jobs started, and this fix is also unobserved remotely; E2E browsers still not installed.

## Next single action
Founder review of the ayanamsha consolidation (not pushed). Do not begin another task before review.
