/**
 * Versioned golden epochs, ΔT values, literature anchors, and tolerances
 * for Phase 3C first-principles Lahiri verification.
 *
 * Lineage per value (established before selection):
 * - CRC-1956 anchor: Calendar Reform Committee definition via Indian
 *   Astronomical Ephemeris 1989 p.556 (t0 = JD 2435553.5 TDT =
 *   1956-03-21 00:00, ayan_t0 = 23°15'00.658" − 16.768926" nutation).
 * - ΔT: NASA/GSFC eclipse site tables (Morrison & Stephenson 2004
 *   historical + Astronomical Almanac observed values, author's
 *   interpolation between tabulated points). Sensitivity is ~1.6e-6"
 *   per second, so interpolation error is nil; values are documented
 *   to 0.1 s.
 * - MEAN 1900: 22°27'37.7" from Indian Ephemeris and Nautical Almanac 1965
 *   p.459 (via AstroWiki's citation of New International Ephemeris
 *   1900–2050, St. Michel 1993: "calculated by N.C. Lahiri, recognised by
 *   the Indian government"). Epoch basis Jan-1 (0h TT assumed; ±12 h is
 *   ±0.07", absorbed by tolerance).
 * - TRUE 2000: 23°51'11" (same AstroWiki/Int'l-Ephemeris source, Jan-1
 *   basis, arcsecond-rounded).
 * - MEAN 1989/1990: IAE 1989 p.512 values 23°42'12.34" and 23°43'02.62"
 *   at Jan-1 0:00 TT, as transcribed in upstream Appendix E (labeled as
 *   transcriptions, not fresh retrievals).
 * - TRUE 2019: IAE 2019 p.427 table via upstream Appendix E: Swiss
 *   reproduction 24°07'05.9864" with in-list agreement at 0.1", so IAE is
 *   24°07'06.0" ± 0.1"; recorded here as 24°07'06.0" with that note.
 *
 * Tolerances (chosen before running any comparison):
 * - FIRST_PRINCIPLES_TOLERANCE_DEG = 2/3600 (2"): my MEAN vs binary MEAN.
 *   Budget: IAU1976-vs-Vondrak theory drift ≤0.5" over 1900–2030, anchor
 *   exact, implementation rounding <0.01" (larger ⇒ fail-loud bug, fixed
 *   against the published standard, never by fitting), TT path (no ΔT),
 *   DMS/decimal parse ≤1e-7°.
 * - TRUE_TOLERANCE_DEG = 2/3600 (2"): adds nutation-series transcription
 *   (L1-bounded) and ΔT interpolation (≤1e-5").
 * - LITERATURE_TOLERANCE_DEG = 2/3600 (2"): publication rounding (±0.5")
 *   + epoch-basis ambiguity (±0.1") + theory drift.
 * - NUTATION_TRANSCRIPTION_TOLERANCE_DEG = 0.01/3600 (0.01"): my IAU2000B
 *   Δψ vs the binary's implied Δψ (TRUE−MEAN). Same published series on
 *   both sides, so tight agreement is expected; failure means this
 *   file-set has a bug, fixed against the published standard.
 */

export interface AyanamshaEpoch {
  readonly label: string;
  /** UTC instant for adapter (TRUE) runs. */
  readonly utcInstant: string;
  /** TT Julian Day for MEAN runs (pure TT path, no ΔT involved). */
  readonly julianDayTt: number;
  /** ΔT = TT − UT in seconds at this epoch (NASA tables / interpolation). */
  readonly deltaTSeconds: number;
}

export const AYANAMSHA_EPOCHS: readonly AyanamshaEpoch[] = [
  {
    label: "1900-01-01 (literature MEAN anchor era)",
    utcInstant: "1900-01-01T00:00:00Z",
    julianDayTt: 2415020.5,
    deltaTSeconds: -3,
  },
  {
    label: "1950-01-01",
    utcInstant: "1950-01-01T00:00:00Z",
    julianDayTt: 2433282.5,
    deltaTSeconds: 29,
  },
  {
    label: "1956-03-21 (anchor epoch t0)",
    utcInstant: "1956-03-21T00:00:00Z",
    julianDayTt: 2435553.5,
    deltaTSeconds: 31.6,
  },
  {
    label: "1989-01-01 (IAE 1989 MEAN anchor)",
    utcInstant: "1989-01-01T00:00:00Z",
    julianDayTt: 2447527.5,
    deltaTSeconds: 56.4,
  },
  {
    label: "1990-01-01 (IAE 1989 MEAN anchor)",
    utcInstant: "1990-01-01T00:00:00Z",
    julianDayTt: 2447892.5,
    deltaTSeconds: 56.9,
  },
  {
    label: "2000-01-01 12:00 (J2000; literature TRUE anchor era)",
    utcInstant: "2000-01-01T12:00:00Z",
    julianDayTt: 2451545.0,
    deltaTSeconds: 63.8,
  },
  {
    label: "2019-01-01 (IAE 2019 TRUE anchor)",
    utcInstant: "2019-01-01T00:00:00Z",
    julianDayTt: 2458484.5,
    deltaTSeconds: 69.2,
  },
  {
    label: "2024-02-29 (leap date)",
    utcInstant: "2024-02-29T18:30:00Z",
    julianDayTt: 2460370.2708333335,
    deltaTSeconds: 69.2,
  },
  {
    label: "2030-01-01 (range end)",
    utcInstant: "2030-01-01T00:00:00Z",
    julianDayTt: 2462502.5,
    deltaTSeconds: 71,
  },
];

export interface LiteratureAnchor {
  readonly label: string;
  readonly valueDeg: number;
  readonly kind: "mean" | "true";
  /** TT Julian Day the value refers to. */
  readonly julianDayTt: number;
  readonly source: string;
}

function dmsToDeg(d: number, m: number, s: number): number {
  return d + m / 60 + s / 3600;
}

export const LITERATURE_ANCHORS: readonly LiteratureAnchor[] = [
  {
    label: "IENA 1965 MEAN 1900-01-01",
    valueDeg: dmsToDeg(22, 27, 37.7),
    kind: "mean",
    julianDayTt: 2415020.5,
    source:
      "Indian Ephemeris and Nautical Almanac 1965 p.459 via AstroWiki " +
      "(New International Ephemeris 1900–2050, St. Michel 1993).",
  },
  {
    label: "Int'l Ephemeris TRUE 2000-01-01",
    valueDeg: dmsToDeg(23, 51, 11),
    kind: "true",
    julianDayTt: 2451544.5,
    source:
      "AstroWiki (New International Ephemeris 1900–2050): 23°51'11\" " +
      "for 1 January 2000, calculated by N.C. Lahiri.",
  },
  {
    label: "IAE 1989 MEAN 1989-01-01 0:00 TT",
    valueDeg: dmsToDeg(23, 42, 12.34),
    kind: "mean",
    julianDayTt: 2447527.5,
    source:
      "IAE 1989 p.512 as transcribed in upstream Appendix E " +
      "(Swiss reproduction agreed to 0.03\").",
  },
  {
    label: "IAE 1989 MEAN 1990-01-01 0:00 TT",
    valueDeg: dmsToDeg(23, 43, 2.62),
    kind: "mean",
    julianDayTt: 2447892.5,
    source:
      "IAE 1989 p.512 as transcribed in upstream Appendix E " +
      "(Swiss reproduction agreed to 0.01\").",
  },
  {
    label: "IAE 2019 TRUE 2019-01-01 (derived 0.1\" rounding)",
    valueDeg: dmsToDeg(24, 7, 6.0),
    kind: "true",
    julianDayTt: 2458484.5,
    source:
      "IAE 2019 p.427 via upstream Appendix E: Swiss reproduction " +
      "24°07'05.9864\" agrees with IAE at 0.1\" ⇒ IAE is 24°07'06.0\" ±0.1\".",
  },
];

export const FIRST_PRINCIPLES_TOLERANCE_DEG = 2 / 3600;
export const TRUE_TOLERANCE_DEG = 2 / 3600;
export const LITERATURE_TOLERANCE_DEG = 2 / 3600;
export const NUTATION_TRANSCRIPTION_TOLERANCE_DEG = 0.01 / 3600;
