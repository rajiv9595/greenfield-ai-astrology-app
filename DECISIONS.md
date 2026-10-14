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

## ADR-005: Vimshottari Dasha Calculation Conventions

**Status:** Accepted for Phase 3E implementation (founder-approved conventions; implementation not started).

This ADR records the approved Vimshottari Mahadasha and Antardasha rules. It preserves ADR-003 (365.25-day dasha year, 120-year cycle, Moon longitude starts the balance, left-inclusive boundaries) and ADR-004 (birth instant converted to UTC as the anchor). No existing decision is altered; no conflict with prior documentation was found. Pratyantardasha and deeper subdivisions are out of scope.

### A. Mahadasha sequence and durations

The sequence repeats cyclically in this order:

| Lord | Duration |
|---|---:|
| Ketu | 7 years |
| Venus | 20 years |
| Sun | 6 years |
| Moon | 10 years |
| Mars | 7 years |
| Rahu | 18 years |
| Jupiter | 16 years |
| Saturn | 19 years |
| Mercury | 17 years |
| **Total** | **120 years** |

Check: 7 + 20 + 6 + 10 + 7 + 18 + 16 + 19 + 17 = 120. The durations sum to exactly 120 years, consistent with the ADR-003 120-year cycle.

### B. Nakshatra-to-lord mapping

Ashwini starts with Ketu. The nine lords are assigned in the order above to consecutive nakshatras, repeating that sequence for all 27 nakshatras. Consequently, Magha (the 10th nakshatra) starts the sequence again with Ketu.

The existing project boundaries apply: left-inclusive, right-exclusive. A Moon longitude exactly on a nakshatra boundary belongs to the nakshatra beginning at that boundary.

### C. Birth Mahadasha balance

Let:
- `f` be the fraction of the birth nakshatra traversed by the Moon, calculated from its sidereal longitude and the existing 13°20′ nakshatra span;
- `Y` be the full duration, in years, of the lord assigned to the birth nakshatra.

Define:

- Elapsed Mahadasha duration at birth = `f × Y`.
- Remaining Mahadasha duration at birth = `(1 − f) × Y`.
- Notional Mahadasha start = birth UTC instant minus the elapsed duration.
- Mahadasha end = notional Mahadasha start plus the full duration `Y × 365.25 days`.

The resulting Mahadasha end must equal the birth instant plus the remaining duration, subject only to the documented timestamp representation precision.

Do not restart the birth Mahadasha at the birth instant: the partially elapsed birth Mahadasha keeps its notional start before birth, so its already-elapsed portion is preserved.

### D. Antardasha rules

Within each Mahadasha, Antardashas follow the same cyclic nine-lord order, beginning with the Mahadasha lord itself.

For each Antardasha:

`Antardasha duration = Mahadasha years × Antardasha lord years ÷ 120`

Anchor the sequence to the **notional Mahadasha start**, not to the birth instant. Determine the Antardasha active at birth by locating the birth instant within the resulting intervals.

For a partially elapsed Mahadasha, some Antardashas may already have started or ended before birth. Preserve that chronology.

This ADR covers Mahadasha and Antardasha only; Pratyantardasha and deeper subdivisions are not added.

### E. Time arithmetic and intervals

- One Dasha year is exactly 365.25 days, as already approved in ADR-003.
- Use the birth instant converted to UTC (per ADR-004) as the anchor.
- All periods use start-inclusive, end-exclusive intervals: `[start, end)`.
- Use integer-millisecond or finer instant representation.
- Compute boundaries from their original canonical anchor at full available precision, rounding only when materializing each absolute boundary at the supported timestamp precision. Do not repeatedly add rounded durations and accumulate drift.
- Ensure consecutive Mahadashas are contiguous and that all Antardashas within a Mahadasha end exactly at its Mahadasha boundary under the chosen precision policy.
- Distinguish mathematical duration precision from the precision of serialized timestamps.
