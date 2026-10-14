# Decisions

## ADR-001: Start as a modular monolith

**Status:** Accepted for Phase 1.

Use Next.js and TypeScript as a single web product. Do not introduce microservices until measured scaling, isolation, or deployment requirements justify them.

## ADR-002: Preserve calculation and narration boundaries

**Status:** Accepted for Phase 1.

The future deterministic calculation engine will be isolated from AI narration. Models may request typed evidence but will never write canonical chart data.

## ADR-003: Calculation conventions and ephemeris release gate

**Status:** Accepted for implementation planning; provider integration blocked pending licence approval.

### Reproducibility contract

The application will promise reproducible calculations, not guaranteed real-life outcomes. Given identical birth inputs and an identical calculation configuration, the engine must return identical results. Every chart snapshot will retain:

- original local date/time, IANA time-zone identifier, coordinates, and birth-time precision;
- UTC instant and time-zone database version used for conversion;
- ephemeris provider and version, ephemeris-data release, and calculation-engine version;
- zodiac, ayanamsha, node, house, and dasha conventions;
- rule-set version and display rounding policy.

### Version 1 conventions

| Concern | Version 1 decision |
|---|---|
| Zodiac | Sidereal |
| Ayanamsha | Lahiri / Chitrapaksha |
| Reference frame | Geocentric ecliptic longitude of date |
| Houses | Whole-sign houses, derived from the Ascendant sign |
| Nodes | Mean lunar node; Ketu is exactly opposite Rahu |
| Core grahas | Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu |
| Longitude storage | Integer microarcseconds, normalized to [0°, 360°) |
| Sign/nakshatra/varga boundaries | Left-inclusive, right-exclusive intervals |
| Nakshatra/pada | 27 nakshatras of 13°20′; four padas of 3°20′ |
| Dasha | Vimshottari; 120-year cycle; 365.25-day dasha year; Moon longitude starts the balance |

Any later option must be a distinct, named configuration. It must never silently alter an existing snapshot or mix results from another convention.

### Ephemeris decision

Swiss Ephemeris is the proposed production provider because it supports the necessary sidereal and house calculations and publishes versioned ephemeris data. Its official dual licence requires either AGPL compliance for the whole project or purchase of a Swiss Ephemeris Professional License before a public proprietary service is activated.

License alignment (2026-10-13): the founder selected the open-source route using the free-source licensing option for Swiss Ephemeris. The intended application license is AGPL-3.0-only, subject to explicit verification of the actual upstream dependency revision, license text, required notices, archive integrity, and redistribution conditions, and to confirmation of compatibility with the upstream terms. The Professional License path is not selected. No Swiss Ephemeris code or data may be shipped, vendored, or used in a public service until that verification is complete and recorded in `work/SWISSEPH_PROVENANCE.md`.

Until then, this project may implement provider-neutral contracts, pure boundary logic, and fixtures that contain no provider material. The provider adapter is a release-blocked dependency, not a fallback to unverified calculations.

### Source material

- Swiss Ephemeris [official licence notice](https://github.com/aloistr/swisseph/blob/master/LICENSE)
- Swiss Ephemeris [official programmer documentation](https://www.astro.com/swisseph/swephprg.htm)

## ADR-004: D1 engine and frozen time-input convention

**Status:** Accepted for Phase 3D implementation (founder-approved after the Step 1 Ascendant reference review).

### Time-input convention (frozen)

Birth date, civil wall time, and named IANA zone convert to UTC via the host zone database; the resulting Julian Day is used directly as the UT input for both house geometry and provider calls. No separate historical DUT1 correction is applied. Nonexistent local times (zone gaps) are rejected; the ECMAScript API exposes no TZDB version, so provenance records that honestly instead of inventing one.

### Ascendant recipe (frozen, Step 1 reference)

Tropical Ascendant from IAU-1982 GMST on the UT Julian Day, Lieske mean obliquity plus the project's IAU-2000B nutation correction, apparent RAMC (east longitude plus equation of the equinoxes Δψ·cos ε), and the standard geocentric Ascendant formula. Sidereal conversion subtracts the engine's own validated TRUE Lahiri ayanamsha (CRC-1956 anchor, IAU-1976 precession, IAU-2000B nutation; TT = UT + interpolated NASA ΔT). The binary's built-in sidereal-house Ascendant is a diagnostic comparison only and must never be substituted for the project's true-ayanamsha result.

### Engine rules

Planets come exclusively from the injected provider under the V1 configuration; Ketu stays exactly Rahu + 180°; retrograde is measured provider motion over +1 day, never inferred from a sign; signs/nakshatras/padas use integer microarcseconds with left-inclusive boundaries; houses are whole-sign from the Ascendant sign; pole latitudes are rejected.

### Tolerances and limitations

Algorithm tolerances (new quantities, not a weakening of Phase 3B/3C): tropical geometry 1", sidereal conversion 2", planets per the astro.com anchor (0.018"). These are separate from birth time/coordinate uncertainty, which dominates real charts (1 s of time moves the Ascendant ~15"; town-centre uncertainty moves it tens of arcseconds). ΔT interpolation/clamping error is nil (~1.6e-6" per second) against tolerance. Out of scope: Vargas, dashas, yogas/doshas, interpretation, and UI.
