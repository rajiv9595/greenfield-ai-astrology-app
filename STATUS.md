# Status

## Current task
Phase 3D D1 birth-chart engine implementation.

## State
Phase 3D is complete. New `packages/astrology-core` engine (`ascendant.ts`, `ayanamsha.ts`, `nutation-iau2000b.ts`, `d1-chart.ts`) computes the tropical Ascendant by the frozen Step 1 recipe (IAU-1982 GMST, Lieske obliquity + IAU-2000B nutation, apparent RAMC), converts with the validated TRUE Lahiri ayanamsha, takes all nine grahas from the injected V1 provider (Ketu exactly Rahu + 180°), and derives sign/degree, nakshatra/pada (left-inclusive microarcsecond boundaries), whole-sign houses, and measured (+1 day) retrograde. Time convention frozen per ADR-004: civil + IANA zone to UTC, JD used directly as UT, no DUT1. Conventions unchanged; no Vargas/dashas/yogas/AI/deployment work done.

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
Founder review of Phase 3D, then explicit approval before Vargas or dasha work begins.
