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
