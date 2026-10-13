# Status

## Current task
Phase 3B provider adapter and reference tests.

## State
Phase 3B is complete. A production-quality Swiss Ephemeris adapter (`packages/swiss-ephemeris`) implements the existing provider-neutral `EphemerisProvider` contract against pinned upstream revision `aacf962d19d79f8bc921dbcdaacf306d85be1917` (sidereal Lahiri, geocentric, whole-sign conventions preserved; mean node with Ketu derived as exactly Rahu + 180°; integer microarcsecond storage). Reference tests anchor the build against two independent sources: astro.com hosted swetest (worst difference 0.00018 arcsec over 3 instants x 8 bodies) and JPL Horizons DE441 vectors (worst difference 0.17 arcsec, Moon; all others <= 0.06 arcsec). The compiled binary and `.se1` data remain outside the repository and are referenced via `SWEPH_BIN` / `SWEPH_EPHE_PATH`. No database, AI provider, secrets, dashas, transits, or deployments are configured.

## Commit

Initial foundation commit: `0425268c6c22d36690386317287cb9dd0f5dd4f7` (this status update will be amended into that commit).

Phase 2 decision commit: `fdc7ac71fc9f866cda24fb07885d878ffc697d5f`.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed (5 files, 24 tests, 1 todo; adapter live/reference tests run when SWEPH_BIN and SWEPH_EPHE_PATH point at the pinned build, otherwise skipped).
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run build` — passed.
- `npm run test:e2e` — not run; browser binaries have not been installed.

## Remaining risks
No production credentials, database, AI provider, or deployments are configured. The provider binary and ephemeris data are build-machine artifacts, not yet part of any deployment story; AGPL Corresponding Source and network-source availability remain open.

## Next single action
Founder review of Phase 3B, then explicit approval before Phase 3C begins.
