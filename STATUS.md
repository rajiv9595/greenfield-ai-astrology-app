# Status

## Current task
Phase 3E Vimshottari Dasha conventions (ADR-005 documentation only; implementation not started).

## State
Phase 3D is accepted at the D1 engine checkpoint `52f14c703fe3e64cc0747023213582f17c72d236`. Phase 3E conventions are approved and documented in ADR-005 (Mahadasha sequence and 120-year durations, Ashwini→Ketu nakshatra mapping, birth-balance with notional Mahadasha start, Antardashas anchored to the notional start, 365.25-day year, `[start, end)` intervals). Dasha implementation has **not started**: no Dasha calculation code, tests, or results exist. Conventions otherwise unchanged. The non-blocking Phase 3D follow-ups (ayanamsha consolidation, stationary-retrograde documentation) remain open for a later task.

## Commit

Starting checkpoint: `c0111491c9a50e09c3181bfe23ae9889d676105f`.

Phase 2 decision commit: `fdc7ac71fc9f866cda24fb07885d878ffc697d5f`.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed with pinned binary (7 files, 53 tests, 0 skipped): 15 offline D1 tests (fidelity, time conversion, binary-anchored geometry, stub boundaries/houses/opposition/retrograde/determinism/rejections) plus 4 live D1 tests (fresh-geometry match, TRUE match, astro.com goldens for all grahas, J2000 Saturn retrograde).
- `npm run build` — passed.
- `npm run test:e2e` — NOT RUN; browser binaries have not been installed.
- Local acceptance (uncommitted, provisional town-centre inputs): sidereal Ascendant Taurus 9°57′22.334″ (39.9562037675°), +0.0006″ vs the reviewed Step 1 nominal 39.956203597°; all grahas, houses, and measured retrograde sane; Rahu–Ketu exactly opposite. No personal birth details written to tracked files.

## Remaining risks
No production credentials, database, AI provider, or deployments are configured. The provider binary and ephemeris data are build-machine artifacts, not yet part of any deployment story; AGPL Corresponding Source and network-source availability remain open. D1 algorithm tolerance (arcseconds) is separate from birth time/coordinate uncertainty (arcminutes); pole latitudes rejected; host TZDB version unknowable via ECMAScript.

## Next single action
Founder review of ADR-005, followed by a separately approved Phase 3E implementation task. Do not begin Dasha implementation in this task.
