/**
 * Tropical Ascendant geometry for the D1 engine (Step 1 reference recipe).
 *
 * Frozen recipe (ADR-004):
 * - Input Julian Day is UT (from civil time + IANA zone, no DUT1).
 * - GMST: IAU-1982 expression via Meeus, Astronomical Algorithms Ch. 11/12:
 *     GMST = 280.46061837 + 360.98564736629·d + 0.000387933·T² − T³/38710000
 *   with d = JD(UT) − 2451545.0 and T in Julian centuries.
 * - Mean obliquity ε0: Lieske polynomial (IAU 1976, adopted by IAU 1980;
 *   Meeus Ch. 22):
 *     ε0 = 23°26'21.448" − 46.8150"T − 0.00059"T² + 0.001813"T³.
 * - True obliquity ε = ε0 + Δε with the project's IAU-2000B nutation.
 * - Apparent RAMC = GMST + east longitude + equation of the equinoxes,
 *   where eqeq = Δψ·cos ε (complementary terms < 0.001" are omitted and
 *   documented as nil against tolerance).
 * - Ascendant (Meeus Ch. 12, geocentric, no aberration/deflection):
 *     Asc = atan2(cos RAMC, −(sin RAMC·cos ε + tan φ·sin ε)).
 *
 * Validated: this recipe reproduces the pinned swetest tropical
 * Ascendant to 0.022" and ARMC to 0.0002" (Phase 3D Step 1 review).
 * Algorithm tolerance (1") is separate from birth time/coordinate
 * uncertainty (arcminutes); see ADR-004.
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function normalize360(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** IAU-1982 Greenwich Mean Sidereal Time in degrees for a UT Julian Day. */
export function greenwichMeanSiderealTimeDeg(julianDayUt: number): number {
  if (!Number.isFinite(julianDayUt)) {
    throw new Error("d1-chart: Julian Day is not finite, refusing GMST");
  }
  const d = julianDayUt - 2451545.0;
  const t = d / 36525.0;
  return normalize360(
    280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000,
  );
}

/** Lieske mean obliquity of the ecliptic in degrees for a UT Julian Day. */
export function meanObliquityDeg(julianDayUt: number): number {
  if (!Number.isFinite(julianDayUt)) {
    throw new Error("d1-chart: Julian Day is not finite, refusing obliquity");
  }
  const t = (julianDayUt - 2451545.0) / 36525.0;
  return (
    (84381.448 - 46.8150 * t - 0.00059 * t * t + 0.001813 * t * t * t) / 3600
  );
}

/**
 * Equation of the equinoxes in degrees (Δψ·cos ε). Complementary
 * sub-milliarcsecond terms are omitted (nil against tolerance).
 */
export function equationOfEquinoxesDeg(
  nutationLongitudeDeg: number,
  trueObliquityDeg: number,
): number {
  return nutationLongitudeDeg * Math.cos(trueObliquityDeg * DEG_TO_RAD);
}

export interface TropicalAscendant {
  /** Geometric tropical Ascendant longitude in degrees [0, 360). */
  readonly ascendantDeg: number;
  /** Apparent right ascension of the MC (RAMC/ARMC) in degrees. */
  readonly apparentRamcDeg: number;
  /** True obliquity used, in degrees. */
  readonly trueObliquityDeg: number;
  /** Mean sidereal time before the equation of the equinoxes. */
  readonly gmstDeg: number;
}

/**
 * Tropical Ascendant from UT Julian Day, latitude and east longitude
 * (both in degrees) and IAU-2000B nutation (degrees). Geocentric.
 * Poles are rejected: the horizon — and hence the Ascendant — is
 * undefined there.
 */
export function tropicalAscendantDeg(
  julianDayUt: number,
  latitudeDeg: number,
  longitudeEastDeg: number,
  nutationLongitudeDeg: number,
  nutationObliquityDeg: number,
): TropicalAscendant {
  for (const [name, value] of [
    ["Julian Day", julianDayUt],
    ["latitude", latitudeDeg],
    ["east longitude", longitudeEastDeg],
    ["nutation in longitude", nutationLongitudeDeg],
    ["nutation in obliquity", nutationObliquityDeg],
  ] as const) {
    if (!Number.isFinite(value)) {
      throw new Error(`d1-chart: ${name} is not finite, refusing Ascendant`);
    }
  }
  if (Math.abs(latitudeDeg) >= 90) {
    throw new Error(
      "d1-chart: latitude must be strictly between -90 and 90 for house geometry (poles undefined)",
    );
  }
  const gmst = greenwichMeanSiderealTimeDeg(julianDayUt);
  const trueObliquity = meanObliquityDeg(julianDayUt) + nutationObliquityDeg;
  const ramc = normalize360(
    gmst +
      longitudeEastDeg +
      equationOfEquinoxesDeg(nutationLongitudeDeg, trueObliquity),
  );
  const ramcRad = ramc * DEG_TO_RAD;
  const epsRad = trueObliquity * DEG_TO_RAD;
  const phiRad = latitudeDeg * DEG_TO_RAD;
  const y = Math.cos(ramcRad);
  const x = -(Math.sin(ramcRad) * Math.cos(epsRad) + Math.tan(phiRad) * Math.sin(epsRad));
  return {
    ascendantDeg: normalize360(Math.atan2(y, x) * RAD_TO_DEG),
    apparentRamcDeg: ramc,
    trueObliquityDeg: trueObliquity,
    gmstDeg: gmst,
  };
}
