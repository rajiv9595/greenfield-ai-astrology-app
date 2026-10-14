/**
 * Production Lahiri/Chitrapaksha ayanamsha model (D1 engine).
 *
 * Lineage: ported from the Phase 3C validated test implementation
 * (tests/unit/ayanamsha-theory.ts), which was written fresh from
 * published standards and verified against the pinned Swiss Ephemeris
 * binary (MEAN 0.29", TRUE 0.29" over 1900–2030) and five printed
 * literature anchors (worst 0.54"). Definition: Calendar Reform
 * Committee 1956 via Indian Astronomical Ephemeris 1989 p.556 —
 *   t0 = JD 2435553.5 TDT, ayan_t0 = 23°15'00.658" − nutation(t0),
 * precessed under IAU 1976 (Lieske); TRUE adds IAU 2000B nutation
 * (McCarthy & Luzum, IERS Conventions 2003; table in
 * ./nutation-iau2000b.ts).
 *
 * A copy-fidelity test pins every exported function here against the
 * Phase 3C implementation. Any change must re-run that verification.
 */

import { NUT2000B_ROWS } from "./nutation-iau2000b";

const DEG_TO_RAD = Math.PI / 180;
const ARCSEC_TO_DEG = 1 / 3600;

/** Anchor epoch of the CRC-1956 Lahiri definition (TDT). */
export const LAHIRI_T0_JD = 2435553.5;

/**
 * Mean anchor value: IAE 1989's corrected 23°15'00.658" minus the
 * Wahr-1980 nutation at t0 (16.768926").
 */
export const LAHIRI_AYAN_T0_DEG =
  (23 * 3600 + 15 * 60 + 0.658 - 16.768926) / 3600;

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function vec(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

/** IAU 1976 (Lieske) precession angles in radians at Julian centuries T. */
export function precessionAnglesIAU1976(tCenturies: number): {
  readonly zeta: number;
  readonly z: number;
  readonly theta: number;
} {
  const t = tCenturies;
  const zetaArcsec = ((0.017998 * t + 0.30188) * t + 2306.2181) * t;
  const zArcsec = ((0.018203 * t + 1.09468) * t + 2306.2181) * t;
  const thetaArcsec = ((-0.041833 * t - 0.42665) * t + 2004.3109) * t;
  return {
    zeta: zetaArcsec * ARCSEC_TO_DEG * DEG_TO_RAD,
    z: zArcsec * ARCSEC_TO_DEG * DEG_TO_RAD,
    theta: thetaArcsec * ARCSEC_TO_DEG * DEG_TO_RAD,
  };
}

/** Mean obliquity of the ecliptic, Lieske IAU 1976, in radians. */
export function meanObliquityIAU1976(tCenturies: number): number {
  const t = tCenturies;
  const epsArcsec = ((0.001813 * t - 0.00059) * t - 46.815) * t + 84381.448;
  return epsArcsec * ARCSEC_TO_DEG * DEG_TO_RAD;
}

type Mat3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

function matVec(m: Mat3, v: Vec3): Vec3 {
  return vec(
    m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
    m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
  );
}

function matTranspose(m: Mat3): Mat3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

/** Right-handed rotation about the x-axis (equatorial <-> ecliptic). */
export function rotationX(angleRad: number): Mat3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [
    [1, 0, 0],
    [0, c, s],
    [0, -s, c],
  ];
}

/** Right-handed rotation about the z-axis. */
export function rotationZ(angleRad: number): Mat3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [
    [c, s, 0],
    [-s, c, 0],
    [0, 0, 1],
  ];
}

/** Right-handed rotation about the y-axis. */
export function rotationY(angleRad: number): Mat3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [
    [c, 0, -s],
    [0, 1, 0],
    [s, 0, c],
  ];
}

function matMul(a: Mat3, b: Mat3): Mat3 {
  return [
    [
      a[0][0] * b[0][0] + a[0][1] * b[1][0] + a[0][2] * b[2][0],
      a[0][0] * b[0][1] + a[0][1] * b[1][1] + a[0][2] * b[2][1],
      a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2] * b[2][2],
    ],
    [
      a[1][0] * b[0][0] + a[1][1] * b[1][0] + a[1][2] * b[2][0],
      a[1][0] * b[0][1] + a[1][1] * b[1][1] + a[1][2] * b[2][1],
      a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2] * b[2][2],
    ],
    [
      a[2][0] * b[0][0] + a[2][1] * b[1][0] + a[2][2] * b[2][0],
      a[2][0] * b[0][1] + a[2][1] * b[1][1] + a[2][2] * b[2][1],
      a[2][0] * b[0][2] + a[2][1] * b[1][2] + a[2][2] * b[2][2],
    ],
  ];
}

/**
 * IAU 1976 precession matrix P(t): mean equator/equinox J2000 -> date.
 * Standard form P = R3(−z) · R2(θ) · R3(−ζ) (Lieske/Aoki; SLALIB).
 */
export function precessionMatrixJ2000ToDate(jdTt: number): Mat3 {
  const t = (jdTt - 2451545.0) / 36525.0;
  const { zeta, z, theta } = precessionAnglesIAU1976(t);
  return matMul(
    rotationZ(-z),
    matMul(rotationY(theta), rotationZ(-zeta)),
  );
}

/** Transposed (inverse) precession: mean equator/equinox of date -> J2000. */
export function precessionMatrixDateToJ2000(jdTt: number): Mat3 {
  return matTranspose(precessionMatrixJ2000ToDate(jdTt));
}

function eclipticLongitudeDeg(v: Vec3): number {
  const lambda = Math.atan2(v.y, v.x) / DEG_TO_RAD;
  return ((lambda % 360) + 360) % 360;
}

/**
 * Predicted MEAN Lahiri ayanamsha in degrees for a TT Julian Day:
 * ayan_t0 − λ, where λ is the ecliptic-t0 longitude of the vernal point
 * of date precessed t → J2000 → t0 under IAU 1976.
 */
export function predictMeanAyanamsha(jdTt: number): number {
  const vernalOfDate = vec(1, 0, 0);
  const inJ2000 = matVec(precessionMatrixDateToJ2000(jdTt), vernalOfDate);
  const inT0Frame = matVec(precessionMatrixJ2000ToDate(LAHIRI_T0_JD), inJ2000);
  const t0Centuries = (LAHIRI_T0_JD - 2451545.0) / 36525.0;
  const inEclipticT0 = matVec(
    rotationX(meanObliquityIAU1976(t0Centuries)),
    inT0Frame,
  );
  const lambda = eclipticLongitudeDeg(inEclipticT0);
  return ((LAHIRI_AYAN_T0_DEG - lambda) % 360 + 360) % 360;
}

function normDeg(arcsec: number): number {
  return ((((arcsec / 3600) % 360) + 360) % 360) * DEG_TO_RAD;
}

/**
 * Fundamental nutation arguments (Simon et al. 1994, arcsecond
 * polynomials), in radians: Moon anomaly, Sun anomaly, Moon latitude
 * argument, Moon elongation, Moon node.
 */
export function nutationArguments(T: number): {
  readonly moonAnomaly: number;
  readonly sunAnomaly: number;
  readonly latitudeArg: number;
  readonly elongation: number;
  readonly node: number;
} {
  return {
    moonAnomaly: normDeg(
      485868.249036 +
        T *
          (1717915923.2178 +
            T * (31.8792 + T * (0.051635 + T * -0.0002447))),
    ),
    sunAnomaly: normDeg(
      1287104.79305 +
        T *
          (129596581.0481 +
            T * (-0.5532 + T * (0.000136 + T * -0.00001149))),
    ),
    latitudeArg: normDeg(
      335779.526232 +
        T *
          (1739527262.8478 +
            T * (-12.7512 + T * (-0.001037 + T * 0.00000417))),
    ),
    elongation: normDeg(
      1072260.70369 +
        T *
          (1602961601.209 +
            T * (-6.3706 + T * (0.006593 + T * -0.00003169))),
    ),
    node: normDeg(
      450160.398036 +
        T * (-6962890.5431 + T * (7.4722 + T * (0.007702 + T * -0.00005939))),
    ),
  };
}

/** One table unit (0.1 microarcseconds = 1e-7 arcseconds) in degrees. */
const TABLE_UNIT_TO_DEG = 1 / 36_000_000_000;

/**
 * Nutation in longitude/latitude (Δψ, Δε) in degrees by the IAU 2000B
 * lunisolar series. Coefficients table: ./nutation-iau2000b.ts.
 */
export function nutation2000B(jdTt: number): {
  readonly dpsiDeg: number;
  readonly depsDeg: number;
} {
  const T = (jdTt - 2451545.0) / 36525.0;
  const args = nutationArguments(T);
  const base = [
    args.moonAnomaly,
    args.sunAnomaly,
    args.latitudeArg,
    args.elongation,
    args.node,
  ];
  let dpsiMas = 0;
  let depsMas = 0;
  for (const row of NUT2000B_ROWS) {
    const arg =
      row[0] * base[0] +
      row[1] * base[1] +
      row[2] * base[2] +
      row[3] * base[3] +
      row[4] * base[4];
    const s = Math.sin(arg);
    const c = Math.cos(arg);
    dpsiMas += (row[5] + row[6] * T) * s + row[7] * c;
    depsMas += (row[8] + row[9] * T) * c + row[10] * s;
  }
  return { dpsiDeg: dpsiMas * TABLE_UNIT_TO_DEG, depsDeg: depsMas * TABLE_UNIT_TO_DEG };
}

/** Predicted TRUE Lahiri ayanamsha: mean prediction + nutation in longitude. */
export function predictTrueAyanamsha(jdTt: number): number {
  return predictMeanAyanamsha(jdTt) + nutation2000B(jdTt).dpsiDeg;
}

/**
 * ΔT = TT − UT in seconds. Anchor values from the NASA/GSFC eclipse
 * tables (Morrison & Stephenson historical + Astronomical Almanac
 * observed; same lineage as tests/unit/ayanamsha-anchors.ts) plus the
 * NASA yearly-table value for 2005.0. Linear interpolation between
 * tabulated points; clamped outside the table.
 *
 * Sensitivity is ~1.6e-6 arcseconds of ayanamsha per second of ΔT, so
 * interpolation and clamping errors are nil against the 2" tolerance;
 * the ayanamsha drift over a whole day is ~0.004". Documented here so
 * the error budget stays explicit rather than hidden.
 */
const DELTA_T_TABLE: readonly (readonly [julianDayUt: number, seconds: number])[] = [
  [2415020.5, -3.0],
  [2433282.5, 29.0],
  [2435553.5, 31.6],
  [2447527.5, 56.4],
  [2447892.5, 56.9],
  [2451545.0, 63.8],
  [2453371.5, 64.69],
  [2458484.5, 69.2],
  [2460370.2708333335, 69.2],
  [2462502.5, 71.0],
];

export function deltaTSeconds(julianDayUt: number): number {
  if (!Number.isFinite(julianDayUt)) {
    throw new Error("d1-chart: Julian Day is not finite, refusing ΔT lookup");
  }
  const table = DELTA_T_TABLE;
  if (julianDayUt <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (julianDayUt <= table[i][0]) {
      const [jd0, dt0] = table[i - 1];
      const [jd1, dt1] = table[i];
      return dt0 + ((dt1 - dt0) * (julianDayUt - jd0)) / (jd1 - jd0);
    }
  }
  return table[table.length - 1][1];
}

/** TRUE Lahiri ayanamsha in degrees for a UT Julian Day (TT = UT + ΔT). */
export function trueAyanamshaAtUt(julianDayUt: number): number {
  return predictTrueAyanamsha(julianDayUt + deltaTSeconds(julianDayUt) / 86400);
}
