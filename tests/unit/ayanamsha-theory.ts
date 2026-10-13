/**
 * First-principles Lahiri/Chitrapaksha ayanamsha model (test support only).
 *
 * Fresh implementation from published standards — no Swiss Ephemeris code
 * is used or consulted here beyond the documented definition it implements:
 *
 * Definition (Calendar Reform Committee 1956, via Indian Astronomical
 * Ephemeris 1989 p.556; IAU 1976 precession theory):
 *   t0 = JD 2435553.5 TDT (1956-03-21 00:00),
 *   ayan_t0 = 23°15'00.658" − nutation(t0) = 23.245524743° (mean),
 *   aya_mean(t) = ayan_t0 − λ, where λ is the ecliptic-t0 longitude of the
 *   vernal point of date precessed t → J2000 → t0 under IAU 1976 (Lieske).
 *
 * Precession angles and mean obliquity are the published Lieske/IAU 1976
 * standard (Lieske et al. 1977; Meeus, Astronomical Algorithms, Ch. 21–22).
 * Nutation is the published IAU 2000B lunisolar series (McCarthy & Luzum,
 * IERS Conventions 2003; coefficients in ./ayanamsha-nut2000b.ts).
 *
 * Validation strategy (see ayanamsha-first-principles.test.ts) is layered
 * so agreement with the pinned binary can never be mistaken for circularity:
 * L0 checks the math against itself and published spot values; L1 checks the
 * nutation transcription against the binary's TRUE−MEAN difference (same
 * published series, so tight agreement is expected — a failure means this
 * file has a bug, to be fixed against the published standard, never by
 * fitting); L2/L3 compare against the binary with theory-drift tolerances;
 * L4 ties both to independent printed publications.
 */

import { NUT2000B_ROWS } from "./ayanamsha-nut2000b";

const DEG_TO_RAD = Math.PI / 180;
const ARCSEC_TO_DEG = 1 / 3600;

/**
 * Proleptic-Gregorian calendar date to Julian Day (TT scale input as civil
 * date + fractional hour). Valid for the tested range 1900–2030; Meeus Ch.7.
 */
export function julianDayTT(
  year: number,
  month: number,
  day: number,
  hour: number,
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5 +
    hour / 24
  );
}

/** Anchor epoch of the CRC-1956 Lahiri definition (TDT). */
export const LAHIRI_T0_JD = 2435553.5;

/**
 * Mean anchor value: IAE 1989's corrected 23°15'00.658" minus the Wahr-1980
 * nutation at t0 (16.768926"). Written in DMS form so the definition stays
 * readable; AYAN_T0_HEADER_DECIMAL is the upstream header's decimal for the
 * transcription check.
 */
export const LAHIRI_AYAN_T0_DEG =
  (23 * 3600 + 15 * 60 + 0.658 - 16.768926) / 3600;
export const LAHIRI_AYAN_T0_HEADER_DECIMAL = 23.250182778 - 0.004658035;

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
 * lunisolar series. Coefficients table: ./ayanamsha-nut2000b.ts.
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
