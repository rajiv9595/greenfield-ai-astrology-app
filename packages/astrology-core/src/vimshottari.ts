/**
 * Vimshottari Mahadasha and Antardasha engine (Phase 3E, ADR-005).
 *
 * Pure deterministic calculation over the caller-supplied sidereal Moon
 * longitude (integer microarcseconds, as produced by the verified D1
 * engine) and birth UTC instant (integer milliseconds). This module holds
 * no ephemeris and recalculates no planetary positions.
 *
 * Approved rules applied (ADR-005):
 * - Nine lords Ketu 7, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18,
 *   Jupiter 16, Saturn 19, Mercury 17 (sum exactly 120 years).
 * - Ashwini starts with Ketu; the order repeats over all 27 nakshatras,
 *   so Magha restarts with Ketu. Left-inclusive boundaries: a longitude
 *   exactly on a nakshatra boundary belongs to the nakshatra beginning
 *   there.
 * - Birth balance: elapsed = f·Y, remaining = (1−f)·Y with f the
 *   traversed fraction of the birth nakshatra; the birth Mahadasha keeps
 *   its notional start (birth minus elapsed) and is never restarted.
 * - Antardashas run MD-years × AD-lord-years ÷ 120, ordered cyclically
 *   from the Mahadasha lord and anchored to the notional Mahadasha
 *   start, so pre-birth Antardashas keep their chronology.
 * - One Dasha year is exactly 365.25 days; all periods are
 *   start-inclusive, end-exclusive `[start, end)`.
 *
 * Precision policy (ADR-005 §E):
 * - Fractional durations are evaluated as exact rational numbers with
 *   BigInt integer arithmetic and rounded half-up to whole milliseconds
 *   only when materializing an absolute boundary. Each boundary is
 *   computed independently from its canonical anchor (the notional
 *   Mahadasha start), never by adding rounded durations, so no drift
 *   accumulates. Every materialized boundary is within 0.5 ms of the
 *   exact mathematical value.
 * - Continuity is exact by construction: consecutive Mahadashas share
 *   one boundary millisecond, and each Antardasha (except the last in
 *   its Mahadasha) ends exactly where the next begins; the last
 *   Antardasha ends exactly at its Mahadasha boundary.
 * - The birth Mahadasha's remaining duration is defined as
 *   full-duration-minus-elapsed in integer milliseconds, so
 *   Mahadasha-end == birth-instant + remaining holds EXACTLY (not
 *   merely within rounding), satisfying ADR-005 §C with no timestamp
 *   representation error at all.
 *
 * Timeline horizon (API choice; ADR-005 defines the rules but no
 * horizon): exactly one full 120-year cycle of nine Mahadashas starting
 * at the notional birth-Mahadasha start (81 Antardashas in total). The
 * birth instant always falls inside the first Mahadasha, so the
 * birth-active Mahadasha and Antardasha are always included, followed
 * by all subsequent periods of the cycle in order.
 */

import {
  FULL_CIRCLE_MICROARCSECONDS,
  NAKSHATRA_WIDTH_MICROARCSECONDS,
} from "./constants";
import { nakshatraIndex } from "./boundaries";
import { V1_CONFIGURATION } from "./configuration";
import type { CalculationConfiguration } from "./types";

export const VIMSHOTTARI_ENGINE_VERSION = "0.1.0-phase3e";

/** Mahadasha/Antardasha lords in ADR-005 cyclic order. */
export const VIMSHOTTARI_LORDS = [
  "ketu",
  "venus",
  "sun",
  "moon",
  "mars",
  "rahu",
  "jupiter",
  "saturn",
  "mercury",
] as const;

export type VimshottariLord = (typeof VIMSHOTTARI_LORDS)[number];

/** Full Mahadasha durations in years, parallel to VIMSHOTTARI_LORDS. */
export const VIMSHOTTARI_LORD_YEARS: readonly number[] = [
  7, 20, 6, 10, 7, 18, 16, 19, 17,
];

/** Exact 120-year cycle length, in years. */
export const VIMSHOTTARI_CYCLE_YEARS = 120;

/** Exactly 365.25 days in milliseconds (ADR-003/ADR-005 year length). */
export const VIMSHOTTARI_YEAR_MILLIS = 365.25 * 86_400_000;

/** Exact 120-year cycle length in milliseconds. */
export const VIMSHOTTARI_CYCLE_MILLIS =
  VIMSHOTTARI_CYCLE_YEARS * VIMSHOTTARI_YEAR_MILLIS;

export interface VimshottariAntardasha {
  readonly lord: VimshottariLord;
  /** Inclusive start, integer milliseconds since the Unix epoch (UTC). */
  readonly startUtcMillis: number;
  /** Exclusive end, integer milliseconds since the Unix epoch (UTC). */
  readonly endUtcMillis: number;
  readonly startUtcInstant: string;
  readonly endUtcInstant: string;
}

export interface VimshottariMahadasha {
  readonly lord: VimshottariLord;
  /** Inclusive start, integer milliseconds since the Unix epoch (UTC). */
  readonly startUtcMillis: number;
  /** Exclusive end, integer milliseconds since the Unix epoch (UTC). */
  readonly endUtcMillis: number;
  readonly startUtcInstant: string;
  readonly endUtcInstant: string;
  /** Nine Antardashas in cyclic order from this Mahadasha's lord. */
  readonly antardashas: readonly VimshottariAntardasha[];
}

export interface VimshottariActivePeriod {
  readonly mahadashaIndex: number;
  readonly mahadashaLord: VimshottariLord;
  readonly antardashaIndex: number;
  readonly antardashaLord: VimshottariLord;
}

export interface VimshottariTimeline {
  readonly configuration: CalculationConfiguration;
  readonly engineVersion: string;
  readonly birthUtcMillis: number;
  readonly birthUtcInstant: string;
  readonly moonLongitudeMicroarcseconds: number;
  readonly moonNakshatraIndex: number;
  readonly birthMahadashaLord: VimshottariLord;
  /** Notional start of the birth Mahadasha (birth minus elapsed). */
  readonly notionalMahadashaStartUtcMillis: number;
  readonly notionalMahadashaStartUtcInstant: string;
  /** Elapsed birth-Mahadasha duration at birth, in whole milliseconds. */
  readonly birthMahadashaElapsedMillis: number;
  /**
   * Remaining birth-Mahadasha duration at birth, in whole milliseconds.
   * Defined as full-duration-minus-elapsed, so
   * `notionalStart + fullDuration === birth + remaining` exactly.
   */
  readonly birthMahadashaRemainingMillis: number;
  /** Nine Mahadashas covering exactly one 120-year cycle. */
  readonly mahadashas: readonly VimshottariMahadasha[];
  /** Period active at the birth instant (always inside mahadashas[0]). */
  readonly activeAtBirth: VimshottariActivePeriod;
  readonly calculatedAt: string;
}

export interface VimshottariInput {
  /** Sidereal Moon longitude, integer microarcseconds in [0°, 360°). */
  readonly moonLongitudeMicroarcseconds: number;
  /** Birth instant, integer milliseconds since the Unix epoch (UTC). */
  readonly birthUtcMillis: number;
}

function assertV1Configuration(
  configuration: CalculationConfiguration,
): void {
  if (
    configuration.zodiac !== "sidereal" ||
    configuration.ayanamsha !== "lahiri" ||
    configuration.houseSystem !== "whole-sign" ||
    configuration.nodeConvention !== "mean" ||
    configuration.dashaYearDays !== 365.25
  ) {
    throw new Error(
      "vimshottari: only the V1 configuration " +
        "(sidereal/Lahiri/whole-sign/mean-node/365.25-day year) is supported; " +
        "refusing to mix conventions silently",
    );
  }
}

function assertSafeInteger(value: number, what: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `vimshottari: ${what} must be a safe integer, refusing chart`,
    );
  }
  return value;
}

function toInstant(millis: number, what: string): string {
  assertSafeInteger(millis, what);
  try {
    return new Date(millis).toISOString();
  } catch {
    throw new Error(
      `vimshottari: ${what} is outside the representable timestamp range, refusing`,
    );
  }
}

/**
 * Exact round-half-up of numerator/denominator (both non-negative
 * BigInts) to a safe-integer number of milliseconds.
 */
function roundMillisToSafeInteger(numerator: bigint, denominator: bigint): number {
  const millis = (numerator + denominator / 2n) / denominator;
  if (millis > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      "vimshottari: duration exceeds safe-integer range, refusing chart",
    );
  }
  return Number(millis);
}

/**
 * Computes the full Vimshottari timeline for one birth instant and Moon
 * longitude. Deterministic for identical inputs. Throws on invalid
 * longitudes, invalid birth instants, unsupported configurations, or
 * instants outside the representable timestamp range.
 */
export function computeVimshottariDasha(
  input: VimshottariInput,
  configuration: CalculationConfiguration = V1_CONFIGURATION,
  options: { readonly calculatedAt?: string } = {},
): VimshottariTimeline {
  assertV1Configuration(configuration);
  const moonLongitude = assertSafeInteger(
    input.moonLongitudeMicroarcseconds,
    "Moon longitude",
  );
  if (
    moonLongitude < 0 ||
    moonLongitude >= FULL_CIRCLE_MICROARCSECONDS
  ) {
    throw new Error(
      "vimshottari: Moon longitude must be normalized to [0°, 360°), refusing chart",
    );
  }
  const birthUtcMillis = assertSafeInteger(
    input.birthUtcMillis,
    "birth instant",
  );

  const nakshatra = nakshatraIndex(moonLongitude);
  const birthLordIndex = nakshatra % VIMSHOTTARI_LORDS.length;
  const birthLordYears = VIMSHOTTARI_LORD_YEARS[birthLordIndex]!;
  const traversed =
    moonLongitude - nakshatra * NAKSHATRA_WIDTH_MICROARCSECONDS;

  // Exact elapsed milliseconds: round-half-up of
  // traversed × Y × yearMillis / nakshatraWidth (all integers).
  const elapsedMillis = roundMillisToSafeInteger(
    BigInt(traversed) *
      BigInt(birthLordYears) *
      BigInt(VIMSHOTTARI_YEAR_MILLIS),
    BigInt(NAKSHATRA_WIDTH_MICROARCSECONDS),
  );
  const fullBirthMillis = birthLordYears * VIMSHOTTARI_YEAR_MILLIS;
  assertSafeInteger(fullBirthMillis, "birth Mahadasha duration");
  const remainingMillis = fullBirthMillis - elapsedMillis;

  const notionalStart = birthUtcMillis - elapsedMillis;
  assertSafeInteger(notionalStart, "notional Mahadasha start");

  const mahadashas: VimshottariMahadasha[] = [];
  let mdStart = notionalStart;
  for (let i = 0; i < VIMSHOTTARI_LORDS.length; i++) {
    const lordIndex = (birthLordIndex + i) % VIMSHOTTARI_LORDS.length;
    const lord = VIMSHOTTARI_LORDS[lordIndex]!;
    const mdYears = VIMSHOTTARI_LORD_YEARS[lordIndex]!;
    const mdDurationMillis = mdYears * VIMSHOTTARI_YEAR_MILLIS;
    assertSafeInteger(mdDurationMillis, `Mahadasha duration (${lord})`);
    const mdEnd = mdStart + mdDurationMillis;
    assertSafeInteger(mdEnd, `Mahadasha end (${lord})`);

    // Antardasha boundaries from the Mahadasha start anchor:
    // offset_k = round(cumLordYears_k × mdYears × yearMillis / 120).
    // Ends chain exactly (each end is the next start; the last end is
    // the Mahadasha end), so continuity holds by construction.
    let cumulativeLordYears = 0;
    const antardashas: VimshottariAntardasha[] = [];
    const adStarts: number[] = [];
    for (let k = 0; k < VIMSHOTTARI_LORDS.length; k++) {
      const adLordIndex = (lordIndex + k) % VIMSHOTTARI_LORDS.length;
      const offsetMillis = roundMillisToSafeInteger(
        BigInt(cumulativeLordYears) *
          BigInt(mdYears) *
          BigInt(VIMSHOTTARI_YEAR_MILLIS),
        BigInt(VIMSHOTTARI_CYCLE_YEARS),
      );
      const adStart = mdStart + offsetMillis;
      assertSafeInteger(adStart, "Antardasha start");
      adStarts.push(adStart);
      cumulativeLordYears += VIMSHOTTARI_LORD_YEARS[adLordIndex]!;
    }
    for (let k = 0; k < VIMSHOTTARI_LORDS.length; k++) {
      const adLordIndex = (lordIndex + k) % VIMSHOTTARI_LORDS.length;
      const adStart = adStarts[k]!;
      const adEnd = k + 1 < adStarts.length ? adStarts[k + 1]! : mdEnd;
      antardashas.push({
        lord: VIMSHOTTARI_LORDS[adLordIndex]!,
        startUtcMillis: adStart,
        endUtcMillis: adEnd,
        startUtcInstant: toInstant(adStart, "Antardasha start"),
        endUtcInstant: toInstant(adEnd, "Antardasha end"),
      });
    }

    mahadashas.push({
      lord,
      startUtcMillis: mdStart,
      endUtcMillis: mdEnd,
      startUtcInstant: toInstant(mdStart, "Mahadasha start"),
      endUtcInstant: toInstant(mdEnd, "Mahadasha end"),
      antardashas,
    });
    mdStart = mdEnd;
  }

  const birthMahadasha = mahadashas[0]!;
  const activeAtBirth = findActiveDashaPeriod(
    mahadashas,
    birthUtcMillis,
  );
  if (activeAtBirth === null) {
    throw new Error(
      "vimshottari: birth instant falls outside the computed cycle, refusing chart",
    );
  }

  return {
    configuration,
    engineVersion: `vimshottari ${VIMSHOTTARI_ENGINE_VERSION}`,
    birthUtcMillis,
    birthUtcInstant: toInstant(birthUtcMillis, "birth instant"),
    moonLongitudeMicroarcseconds: moonLongitude,
    moonNakshatraIndex: nakshatra,
    birthMahadashaLord: birthMahadasha.lord,
    notionalMahadashaStartUtcMillis: birthMahadasha.startUtcMillis,
    notionalMahadashaStartUtcInstant: birthMahadasha.startUtcInstant,
    birthMahadashaElapsedMillis: elapsedMillis,
    birthMahadashaRemainingMillis: remainingMillis,
    mahadashas,
    activeAtBirth,
    calculatedAt: options.calculatedAt ?? new Date().toISOString(),
  };
}

/**
 * Locates the Mahadasha and Antardasha active at a UTC instant using
 * half-open `[start, end)` semantics. Returns null when the instant
 * lies outside every supplied Mahadasha.
 */
export function findActiveDashaPeriod(
  mahadashas: readonly VimshottariMahadasha[],
  utcMillis: number,
): VimshottariActivePeriod | null {
  if (!Number.isSafeInteger(utcMillis)) return null;
  for (let i = 0; i < mahadashas.length; i++) {
    const md = mahadashas[i]!;
    if (utcMillis < md.startUtcMillis || utcMillis >= md.endUtcMillis) {
      continue;
    }
    for (let k = 0; k < md.antardashas.length; k++) {
      const ad = md.antardashas[k]!;
      if (utcMillis >= ad.startUtcMillis && utcMillis < ad.endUtcMillis) {
        return {
          mahadashaIndex: i,
          mahadashaLord: md.lord,
          antardashaIndex: k,
          antardashaLord: ad.lord,
        };
      }
    }
    return null;
  }
  return null;
}
