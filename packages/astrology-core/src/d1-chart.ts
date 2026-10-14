/**
 * D1 (Rasi) birth-chart engine.
 *
 * Computes, for one birth input under the V1 configuration
 * (sidereal / Lahiri / whole-sign / mean-node):
 * - tropical Ascendant by the frozen Step 1 recipe (./ascendant.ts),
 *   converted to sidereal with the validated TRUE ayanamsha
 *   (./ayanamsha.ts) — never the binary's built-in sidereal-house value;
 * - sidereal longitudes for the nine grahas from the injected
 *   provider-neutral EphemerisProvider (planetary code and data stay in
 *   the provider; this engine holds no ephemeris);
 * - sign, degree-in-sign, nakshatra, pada (left-inclusive boundaries),
 *   whole-sign houses from the Ascendant sign, and retrograde state from
 *   measured provider motion over +1 day (never guessed from a sign).
 *
 * Rahu/Ketu: the provider supplies the mean node and derives Ketu as
 * exactly Rahu + 180°; this engine preserves that opposition and samples
 * both instants through the provider, so Ketu motion is measured too.
 */

import { tropicalAscendantDeg } from "./ascendant";
import {
  nutation2000B,
  predictTrueAyanamsha,
  deltaTSeconds,
} from "./ayanamsha";
import {
  nakshatraIndex,
  normalizeLongitude,
  padaIndex,
  signIndex,
} from "./boundaries";
import { V1_CONFIGURATION, validateBirthInput } from "./configuration";
import {
  FULL_CIRCLE_MICROARCSECONDS,
  MICROARCSECONDS_PER_DEGREE,
  SIGN_WIDTH_MICROARCSECONDS,
} from "./constants";
import type {
  BirthInput,
  CalculationConfiguration,
  CalculationProvenance,
  EphemerisProvider,
} from "./types";

export const D1_ENGINE_VERSION = "0.1.0-phase3d";

/** Grahas in provider call order (Ketu derived by the provider). */
export const D1_BODIES = [
  "sun",
  "moon",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
  "rahu",
  "ketu",
] as const;

export type D1Body = (typeof D1_BODIES)[number];

/** Forward sampling baseline for measured daily motion. */
export const RETROGRADE_SAMPLE_DAYS = 1;

const JULIAN_DAY_UNIX_EPOCH = 2440587.5;
const MILLISECONDS_PER_DAY = 86_400_000;

/** ECMAScript exposes no TZDB version; record that honestly. */
export const HOST_TIME_ZONE_NOTE =
  "host Intl (ECMAScript does not expose the TZDB version)";

export interface D1Placement {
  readonly body: D1Body;
  /** Sidereal longitude, integer microarcseconds in [0°, 360°). */
  readonly longitudeMicroarcseconds: number;
  /** 0 = Aries … 11 = Pisces. */
  readonly signIndex: number;
  /** Integer microarcseconds east of the sign ingress. */
  readonly degreeInSignMicroarcseconds: number;
  /** 0 = Ashwini … 26 = Revati. */
  readonly nakshatraIndex: number;
  /** Global pada 0 … 107 (four per nakshatra, left-inclusive). */
  readonly padaIndex: number;
  /** Pada within its nakshatra, 1 … 4. */
  readonly padaNumber: number;
  /** Whole-sign house counted from the Ascendant sign, 1 … 12. */
  readonly house: number;
  /** True when measured provider motion over +1 day is westward. */
  readonly retrograde: boolean;
}

export interface D1Ascendant {
  /** Sidereal longitude, integer microarcseconds in [0°, 360°). */
  readonly longitudeMicroarcseconds: number;
  readonly signIndex: number;
  readonly degreeInSignMicroarcseconds: number;
  readonly nakshatraIndex: number;
  readonly padaIndex: number;
  readonly padaNumber: number;
  /** Geometric tropical Ascendant before ayanamsha, in degrees. */
  readonly tropicalLongitudeDeg: number;
  /** TRUE Lahiri ayanamsha applied, in degrees. */
  readonly ayanamshaTrueDeg: number;
}

export interface D1Chart {
  readonly configuration: CalculationConfiguration;
  readonly localDateTime: string;
  readonly timeZone: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timePrecision: BirthInput["timePrecision"];
  /** Canonical UTC instant used for every provider call. */
  readonly utcInstant: string;
  readonly julianDayUt: number;
  readonly ayanamshaTrueDeg: number;
  readonly ascendant: D1Ascendant;
  readonly placements: Record<D1Body, D1Placement>;
  readonly provenance: CalculationProvenance;
}

function assertV1Configuration(configuration: CalculationConfiguration): void {
  if (
    configuration.zodiac !== "sidereal" ||
    configuration.ayanamsha !== "lahiri" ||
    configuration.houseSystem !== "whole-sign" ||
    configuration.nodeConvention !== "mean" ||
    configuration.dashaYearDays !== 365.25
  ) {
    throw new Error(
      "d1-chart: only the V1 configuration " +
        "(sidereal/Lahiri/whole-sign/mean-node/365.25-day year) is supported; " +
        "refusing to mix conventions silently",
    );
  }
}

function assertProviderLongitude(value: number, body: string): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= FULL_CIRCLE_MICROARCSECONDS
  ) {
    throw new Error(
      `d1-chart: invalid provider longitude for ${body}, refusing chart`,
    );
  }
  return value;
}

const LOCAL_PARTS =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function timeZoneOffsetMillis(timeZone: string, utcMillis: number): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(utcMillis))) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"]) === 24 ? 0 : Number(parts["hour"]),
    Number(parts["minute"]),
    Number(parts["second"]),
  );
  if (!Number.isFinite(asUtc)) {
    throw new Error("d1-chart: time-zone conversion failed, refusing chart");
  }
  return asUtc - utcMillis;
}

/**
 * Approved practical time convention: interpret the civil wall time in
 * the named IANA zone and convert to UTC via the host zone database.
 * The resulting Julian Day is used directly as the UT input; no
 * separate historical DUT1 correction is applied. Nonexistent local
 * times (zone gaps) are rejected by round-trip check.
 */
export function birthInputToUtcMillis(input: BirthInput): number {
  validateBirthInput(input);
  const match = LOCAL_PARTS.exec(input.localDateTime);
  if (match === null) {
    throw new Error(
      "d1-chart: localDateTime must be a valid ISO local date-time without an offset",
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = localAsUtc;
  for (let i = 0; i < 3; i++) {
    guess = localAsUtc - timeZoneOffsetMillis(input.timeZone, guess);
  }
  const check = new Date(guess + timeZoneOffsetMillis(input.timeZone, guess));
  const pad = (n: number): string => String(n).padStart(2, "0");
  const roundTrip =
    `${check.getUTCFullYear()}-${pad(check.getUTCMonth() + 1)}-${pad(check.getUTCDate())}` +
    `T${pad(check.getUTCHours())}:${pad(check.getUTCMinutes())}:${pad(check.getUTCSeconds())}`;
  const expected =
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${pad(second)}`;
  if (roundTrip !== expected) {
    throw new Error(
      "d1-chart: local time does not exist in the named zone, refusing chart",
    );
  }
  return guess;
}

/** Canonical UTC instant string for provider calls. */
export function birthInputToUtcInstant(input: BirthInput): string {
  return new Date(birthInputToUtcMillis(input)).toISOString();
}

/** UT Julian Day for a UTC millisecond epoch (same scale as the adapter). */
export function utcMillisToJulianDayUt(utcMillis: number): number {
  if (!Number.isFinite(utcMillis)) {
    throw new Error("d1-chart: UTC instant is not finite, refusing chart");
  }
  return utcMillis / MILLISECONDS_PER_DAY + JULIAN_DAY_UNIX_EPOCH;
}

/** Signed eastward difference b − a in microarcseconds, in (−180°, +180°]. */
export function signedDifferenceMicroarcseconds(a: number, b: number): number {
  const half = FULL_CIRCLE_MICROARCSECONDS / 2;
  let d = (b - a) % FULL_CIRCLE_MICROARCSECONDS;
  if (d > half) d -= FULL_CIRCLE_MICROARCSECONDS;
  if (d <= -half) d += FULL_CIRCLE_MICROARCSECONDS;
  return d;
}

function quantize(degrees: number, what: string): number {
  if (!Number.isFinite(degrees)) {
    throw new Error(`d1-chart: ${what} is not finite, refusing chart`);
  }
  return normalizeLongitude(Math.round(degrees * MICROARCSECONDS_PER_DEGREE));
}

function describeLongitude(longitudeMicroarcseconds: number): {
  readonly signIndex: number;
  readonly degreeInSignMicroarcseconds: number;
  readonly nakshatraIndex: number;
  readonly padaIndex: number;
  readonly padaNumber: number;
} {
  const normalized = normalizeLongitude(longitudeMicroarcseconds);
  const sign = signIndex(normalized);
  const nakshatra = nakshatraIndex(normalized);
  const pada = padaIndex(normalized);
  return {
    signIndex: sign,
    degreeInSignMicroarcseconds: normalized - sign * SIGN_WIDTH_MICROARCSECONDS,
    nakshatraIndex: nakshatra,
    padaIndex: pada,
    padaNumber: (pada % 4) + 1,
  };
}

interface ProviderWithProvenance extends EphemerisProvider {
  provenance?(calculatedAt: string): CalculationProvenance;
}

function resolveProvenance(
  provider: EphemerisProvider,
  calculatedAt: string,
): CalculationProvenance {
  const maybe = (provider as ProviderWithProvenance).provenance;
  if (typeof maybe === "function") {
    return (provider as ProviderWithProvenance).provenance!(calculatedAt);
  }
  return {
    engineVersion: `d1-chart ${D1_ENGINE_VERSION}`,
    ephemerisProvider: `${provider.id} (${provider.dataVersion})`,
    ephemerisDataVersion: provider.dataVersion,
    timeZoneDataVersion: HOST_TIME_ZONE_NOTE,
    calculatedAt,
  };
}

/**
 * Computes the whole D1 chart. Deterministic for identical inputs with
 * a deterministic provider. Throws on invalid inputs, unsupported
 * configurations, pole latitudes, or invalid provider responses.
 */
export async function computeD1Chart(
  input: BirthInput,
  provider: EphemerisProvider,
  configuration: CalculationConfiguration = V1_CONFIGURATION,
  options: { readonly calculatedAt?: string } = {},
): Promise<D1Chart> {
  validateBirthInput(input);
  assertV1Configuration(configuration);
  if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) >= 90) {
    throw new Error(
      "d1-chart: latitude must be strictly between -90 and 90 for house geometry (poles undefined)",
    );
  }
  if (provider === null || provider === undefined) {
    throw new Error("d1-chart: an ephemeris provider is required");
  }

  const utcMillis = birthInputToUtcMillis(input);
  const utcInstant = new Date(utcMillis).toISOString();
  const julianDayUt = utcMillisToJulianDayUt(utcMillis);

  const julianDayTt = julianDayUt + deltaTSeconds(julianDayUt) / 86400;
  const ayanamshaTrue = predictTrueAyanamsha(julianDayTt);
  const nutation = nutation2000B(julianDayTt);
  const tropical = tropicalAscendantDeg(
    julianDayUt,
    input.latitude,
    input.longitude,
    nutation.dpsiDeg,
    nutation.depsDeg,
  );
  const siderealDeg = ((tropical.ascendantDeg - ayanamshaTrue) % 360 + 360) % 360;
  const ascendantLongitude = quantize(siderealDeg, "sidereal Ascendant");
  const ascendantParts = describeLongitude(ascendantLongitude);

  const laterInstant = new Date(
    utcMillis + RETROGRADE_SAMPLE_DAYS * MILLISECONDS_PER_DAY,
  ).toISOString();
  const placements = {} as Record<D1Body, D1Placement>;
  for (const body of D1_BODIES) {
    const now = await provider.positionAt(utcInstant, body, configuration);
    const later = await provider.positionAt(laterInstant, body, configuration);
    const longitude = assertProviderLongitude(
      now.longitudeMicroarcseconds,
      body,
    );
    const laterLongitude = assertProviderLongitude(
      later.longitudeMicroarcseconds,
      `${body} (+1d)`,
    );
    const parts = describeLongitude(longitude);
    placements[body] = {
      body,
      longitudeMicroarcseconds: longitude,
      signIndex: parts.signIndex,
      degreeInSignMicroarcseconds: parts.degreeInSignMicroarcseconds,
      nakshatraIndex: parts.nakshatraIndex,
      padaIndex: parts.padaIndex,
      padaNumber: parts.padaNumber,
      house:
        ((parts.signIndex - ascendantParts.signIndex) % 12 + 12) % 12 + 1,
      retrograde:
        signedDifferenceMicroarcseconds(longitude, laterLongitude) < 0,
    };
  }

  const calculatedAt =
    options.calculatedAt ?? new Date().toISOString();
  return {
    configuration,
    localDateTime: input.localDateTime,
    timeZone: input.timeZone,
    latitude: input.latitude,
    longitude: input.longitude,
    timePrecision: input.timePrecision,
    utcInstant,
    julianDayUt,
    ayanamshaTrueDeg: ayanamshaTrue,
    ascendant: {
      longitudeMicroarcseconds: ascendantLongitude,
      signIndex: ascendantParts.signIndex,
      degreeInSignMicroarcseconds:
        ascendantParts.degreeInSignMicroarcseconds,
      nakshatraIndex: ascendantParts.nakshatraIndex,
      padaIndex: ascendantParts.padaIndex,
      padaNumber: ascendantParts.padaNumber,
      tropicalLongitudeDeg: tropical.ascendantDeg,
      ayanamshaTrueDeg: ayanamshaTrue,
    },
    placements,
    provenance: resolveProvenance(provider, calculatedAt),
  };
}
