# Status

## Current task
Phase 3E Vimshottari Dasha engine implementation.

## State
Phase 3D is accepted at the D1 engine checkpoint `52f14c703fe3e64cc0747023213582f17c72d236`. Phase 3E is complete: new `packages/astrology-core/src/vimshottari.ts` computes Vimshottari Mahadashas and Antardashas per ADR-005 from the D1 Moon longitude and birth UTC instant (nine lords Ketu 7 through Mercury 17, Ashwini→Ketu mapping, birth balance with notional Mahadasha start, Antardashas MD×AD÷120 anchored to the notional start, 365.25-day year, `[start, end)` intervals). Boundaries use exact BigInt rational arithmetic rounded half-up to milliseconds from canonical anchors (no drift); continuity is exact by construction and Mahadasha-end == birth + remaining holds exactly. Timeline horizon (API choice, ADR-005 defines no horizon): one 120-year cycle of nine Mahadashas (81 Antardashas) from the notional birth-Mahadasha start, always containing the birth-active periods. No Pratyantardasha, Vargas, yogas, or other features. The non-blocking Phase 3D follow-ups (ayanamsha consolidation, stationary-retrograde documentation) remain open for a later task.

## Commit

Starting checkpoint: `504f8b9b93712add4be5b9e83086b9f33f72d195`.

Phase 2 decision commit: `fdc7ac71fc9f866cda24fb07885d878ffc697d5f`.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed with pinned binary (8 files, 69 tests, 0 skipped): prior 53 tests unchanged plus 16 new Vimshottari tests (sequence table, all-9 lords, all-27 mapping, left-inclusive boundaries, hand-computed balances, MD order with exact 120-year cycle, hand-computed Venus-MD Antardashas, birth-active Antardasha with pre-birth chronology, half-open transitions, determinism, leap-day and year-boundary cases, D1 wiring, rejections).
- `npm run build` — passed.
- `npm run test:e2e` — NOT RUN; browser binaries have not been installed.
- Local acceptance (uncommitted, provisional town-centre inputs): sidereal Ascendant Taurus 9°57′22.334″ (39.9562037675°), +0.0006″ vs the reviewed Step 1 nominal 39.956203597°; all grahas, houses, and measured retrograde sane; Rahu–Ketu exactly opposite. No personal birth details written to tracked files.

## Remaining risks
No production credentials, database, AI provider, or deployments are configured. The provider binary and ephemeris data are build-machine artifacts, not yet part of any deployment story; AGPL Corresponding Source and network-source availability remain open. D1 algorithm tolerance (arcseconds) is separate from birth time/coordinate uncertainty (arcminutes); pole latitudes rejected; host TZDB version unknowable via ECMAScript.

## Next single action
Founder review of Phase 3E. Do not start another phase after completion; wait for founder review.
