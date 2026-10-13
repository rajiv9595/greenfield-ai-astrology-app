/**
 * Embedded golden reference vectors for Phase 3B reference tests.
 *
 * The values below were obtained live on 2026-10-13 from sources
 * independent of the local MinGW build under test, then embedded here so
 * the test suite runs offline and deterministically. Retrieval scripts and
 * raw responses are kept outside the repository (build-machine temp dir);
 * the provenance of each value is documented per field.
 *
 * Conventions for every golden instant: geocentric ecliptic longitude,
 * degrees decimal in [0, 360). Sidereal values use Lahiri/Chitrapaksha
 * (swetest method 1). J2000 values are the J2000-frame ecliptic with
 * light-time correction but no aberration, deflection, precession, or
 * nutation (swetest -noaberr -nodefl -nonut -j2000).
 *
 * Tolerances (fixed before comparison, never loosened to pass):
 * - ASTRO_TOLERANCE_DEG = 5e-6 (0.018"): independent-run anchor on
 *   astro.com (same software, different build/machine). Covers their
 *   7-decimal display rounding with wide margin; flag or revision errors
 *   would show as degree-level differences.
 * - HORIZONS_TOLERANCE_DEG = 1/3600 (1"): different software and data
 *   lineage (NASA JPL DE441 direct vs Swiss compressed .se1).
 * - AYANAMSHA_TOLERANCE_DEG = 1e-6: astro.com prints ayanamsha to 0.0001".
 * - SIDEREAL_IDENTITY_TOLERANCE_DEG = 5e-8: sidereal = tropical - ayanamsha
 *   from the same binary. Budget: golden ayanamsha is parsed from astro.com's
 *   DMS display (0.0001" resolution, up to 1.4e-8 deg quantization), plus
 *   negligible tropical-print (5e-12) and microarcsecond (1.4e-10) terms.
 */

export interface GoldenInstant {
  readonly label: string;
  readonly utcInstant: string;
  readonly julianDayUt: number;
  /** Sidereal Lahiri longitudes from astro.com hosted swetest. */
  readonly astroSidereal: Readonly<Record<string, number>>;
  /** Lahiri ayanamsha in degrees, parsed from astro.com DMS output. */
  readonly astroAyanamshaDeg: number;
  /**
   * Raw J2000-ecliptic light-time-corrected position vectors from JPL
   * Horizons (km). Tests derive longitude = atan2(y, x) so the primary
   * evidence, not a transcription, is embedded.
   */
  readonly horizonsVectorsKm: Readonly<Record<string, readonly [number, number]>>;
}

export const ASTRO_TOLERANCE_DEG = 5e-6;
export const HORIZONS_TOLERANCE_DEG = 1 / 3600;
export const AYANAMSHA_TOLERANCE_DEG = 1e-6;
export const SIDEREAL_IDENTITY_TOLERANCE_DEG = 5e-8;

export const GOLDEN_SOURCE_NOTES = [
  "astro.com: https://www.astro.com/cgi/swetest.cgi with b=1.1.2000, n=1, s=1, " +
    "p=0123456m, e=-eswe, f=Pl, arg='-sid1 -ut -bj<jdUt>'; server reports " +
    "version 2.10.03; ayanamsha parsed from the 'ayanamsa = .. (Lahiri)' line.",
  "JPL Horizons API vectors: EPHEM_TYPE=VECTORS, CENTER='500@399' " +
    "(geocentric), TLIST=<jdUt> JD with TIME_TYPE=UT, REF_PLANE=ECLIPTIC, " +
    "VEC_TABLE=1, VEC_CORR=LT, CSV output; longitude = atan2(y, x) of the " +
    "light-time-corrected J2000 position vector.",
] as const;

function atan2Deg(y: number, x: number): number {
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export { atan2Deg };

export const GOLDEN_INSTANTS: readonly GoldenInstant[] = [
  {
    label: "A/2000-01-01T12:00:00Z (J2000 neighbourhood)",
    utcInstant: "2000-01-01T12:00:00Z",
    julianDayUt: 2451545.0,
    astroSidereal: {
      sun: 256.5156962,
      moon: 199.470529,
      mercury: 248.0360546,
      venus: 217.7125659,
      mars: 304.11008,
      jupiter: 1.3998647,
      saturn: 16.542441,
      rahu: 101.1874236,
    },
    astroAyanamshaDeg: 23.853222472222225,
    horizonsVectorsKm: {
      sun: [26500941.41757992, -144696939.4464514],
      moon: [-291527.9592926465, -275018.3152735081],
      mercury: [7015458.578245942, -211603037.4150029],
      venus: [-80956247.65945013, -149564261.1593157],
      mars: [234548078.3786055, -146726570.0838988],
      jupiter: [625086281.0942466, 294882753.3700387],
      saturn: [984917873.6414133, 838130736.6763513],
    },
  },
  {
    label: "B/1990-04-21T09:00:00Z (= 14:30 IST, birth-like)",
    utcInstant: "1990-04-21T09:00:00Z",
    julianDayUt: 2448002.875,
    astroSidereal: {
      sun: 7.2741448,
      moon: 314.8957904,
      mercury: 23.6239215,
      venus: 322.1538839,
      mars: 306.6135262,
      jupiter: 71.6763113,
      saturn: 271.4629336,
      rahu: 288.8917714,
    },
    astroAyanamshaDeg: 23.724827805555552,
    horizonsVectorsKm: {
      sun: [128683162.7024032, 77739731.49291855],
      moon: [347514.1806160659, -135096.2768428008],
      saturn: [631229807.0853016, -1334199494.694979],
    },
  },
  {
    label: "C/2024-02-29T18:30:00Z (leap date)",
    utcInstant: "2024-02-29T18:30:00Z",
    julianDayUt: 2460370.2708333335,
    astroSidereal: {
      sun: 316.4660975,
      moon: 193.509837,
      mercury: 317.6978596,
      venus: 292.0159725,
      mars: 288.546312,
      jupiter: 17.0817455,
      saturn: 315.6917908,
      rahu: 353.5186739,
    },
    astroAyanamshaDeg: 24.193386,
    horizonsVectorsKm: {
      sun: [139567826.3469053, -49893014.3359879],
      moon: [-317501.0452943444, -242431.5722876562],
      saturn: [1500812894.619093, -559502093.5255748],
    },
  },
];
