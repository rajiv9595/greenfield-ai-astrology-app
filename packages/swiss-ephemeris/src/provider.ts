import { execFile } from "node:child_process";
import { normalizeLongitude } from "../../astrology-core/src/boundaries";
import { MICROARCSECONDS_PER_DEGREE } from "../../astrology-core/src/constants";
import type {
  CalculationConfiguration,
  CalculationProvenance,
  EphemerisPosition,
  EphemerisProvider,
} from "../../astrology-core/src/types";
import {
  SWISS_EPHEMERIS_ADAPTER_VERSION,
  SWISS_EPHEMERIS_DATA_VERSION,
  SWISS_EPHEMERIS_LIBRARY_VERSION,
  SWISS_EPHEMERIS_PROVIDER_ID,
  SWISS_EPHEMERIS_UPSTREAM_REVISION,
} from "./build-info";

const JULIAN_DAY_UNIX_EPOCH = 2440587.5;
const MILLISECONDS_PER_DAY = 86_400_000;
const MICROARCSECONDS_PER_HALF_CIRCLE = 180 * MICROARCSECONDS_PER_DEGREE;

/** Bodies supported by positionAt, in swetest output order. */
const SUPPORTED_BODIES = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "rahu",
  "ketu",
] as const;

export type SupportedBody = (typeof SUPPORTED_BODIES)[number];

/** swetest planet-selection letters for one batched call: Sun..Saturn + mean node. */
const SWETEST_BATCH_LETTERS = "0123456m";

const SWETEST_BODY_NAMES = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "mean node",
] as const;

export interface SwissEphemerisAdapterOptions {
  /** Absolute path to the pinned swetest binary (or SWEPH_BIN). */
  readonly swetestPath?: string;
  /** Directory holding the pinned .se1 data files (or SWEPH_EPHE_PATH). */
  readonly ephePath?: string;
  /** Child-process timeout in milliseconds. Defaults to 60_000. */
  readonly timeoutMs?: number;
}

function resolveRequired(name: string, value: string | undefined): string {
  if (value !== undefined && value !== "") return value;
  const fromEnv = process.env[name];
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  throw new Error(
    `SwissEphemerisProvider: ${name} is not configured; pass it explicitly or set the environment variable`,
  );
}

/**
 * Converts an ISO-8601 UTC instant (e.g. 2000-01-01T12:00:00Z) to a
 * Julian Day number in UT. Pure arithmetic: Date.parse already interprets
 * the instant on the UTC scale, so no time-zone database is involved.
 */
export function utcInstantToJulianDay(utcInstant: string): number {
  const millis = Date.parse(utcInstant);
  if (!Number.isFinite(millis)) {
    throw new Error(
      `SwissEphemerisProvider: invalid UTC instant ${JSON.stringify(utcInstant)}`,
    );
  }
  return millis / MILLISECONDS_PER_DAY + JULIAN_DAY_UNIX_EPOCH;
}

/** Converts decimal degrees to integer microarcseconds without normalizing. */
export function degreesToMicroarcseconds(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new Error(
      "SwissEphemerisProvider: longitude is not finite, refusing to quantize",
    );
  }
  return Math.round(degrees * MICROARCSECONDS_PER_DEGREE);
}

function isSupportedBody(body: string): body is SupportedBody {
  return (SUPPORTED_BODIES as readonly string[]).includes(body);
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
      "SwissEphemerisProvider: only the V1 configuration " +
        "(sidereal/Lahiri/whole-sign/mean-node/365.25-day year) is supported; " +
        "refusing to mix conventions silently",
    );
  }
}

function runSwetest(
  swetestPath: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      swetestPath,
      [...args],
      { timeout: timeoutMs, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(
            new Error(
              `SwissEphemerisProvider: swetest failed (${error.message})`,
            ),
          );
          return;
        }
        resolve(stdout);
      },
    );
  });
}

const OUTPUT_LINE = /^([A-Za-z][A-Za-z ]*?)\s+(-?\d+(?:\.\d+)?)\s*$/;

/**
 * Isolated Swiss Ephemeris adapter behind the provider-neutral
 * EphemerisProvider contract. Positions come exclusively from the pinned
 * swetest binary; Ketu is derived as exactly Rahu + 180 degrees using the
 * core integer boundary rules. No second provider is involved.
 */
export class SwissEphemerisProvider implements EphemerisProvider {
  readonly id = SWISS_EPHEMERIS_PROVIDER_ID;
  readonly dataVersion = SWISS_EPHEMERIS_DATA_VERSION;

  private readonly swetestPath: string;
  private readonly ephePath: string;
  private readonly timeoutMs: number;

  constructor(options: SwissEphemerisAdapterOptions = {}) {
    this.swetestPath = resolveRequired("SWEPH_BIN", options.swetestPath);
    this.ephePath = resolveRequired("SWEPH_EPHE_PATH", options.ephePath);
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  async positionAt(
    utcInstant: string,
    body: string,
    configuration: CalculationConfiguration,
  ): Promise<EphemerisPosition> {
    if (!isSupportedBody(body)) {
      throw new Error(
        `SwissEphemerisProvider: unsupported body ${JSON.stringify(body)}; ` +
          `supported bodies are ${SUPPORTED_BODIES.join(", ")}`,
      );
    }
    assertV1Configuration(configuration);
    const jdUt = utcInstantToJulianDay(utcInstant);
    const stdout = await runSwetest(
      this.swetestPath,
      [
        `-edir${this.ephePath}`,
        "-eswe",
        "-sid1",
        "-ut",
        `-bj${jdUt.toFixed(9)}`,
        `-p${SWETEST_BATCH_LETTERS}`,
        "-fPl",
        "-ep",
        "-head",
      ],
      this.timeoutMs,
    );
    const longitudes = parseBatchOutput(stdout);
    const providerBodyId =
      body === "ketu" ? "ketu (derived: rahu + 180deg)" : body;
    const longitudeMicroarcseconds =
      body === "ketu"
        ? normalizeLongitude(
            longitudes.get("mean node")! + MICROARCSECONDS_PER_HALF_CIRCLE,
          )
        : longitudes.get(body === "rahu" ? "mean node" : body)!;
    return { longitudeMicroarcseconds, providerBodyId };
  }

  provenance(calculatedAt: string = new Date().toISOString()): CalculationProvenance {
    return {
      engineVersion: `${SWISS_EPHEMERIS_ADAPTER_VERSION} (swetest ${SWISS_EPHEMERIS_LIBRARY_VERSION})`,
      ephemerisProvider: `${SWISS_EPHEMERIS_PROVIDER_ID} ${SWISS_EPHEMERIS_LIBRARY_VERSION} (upstream ${SWISS_EPHEMERIS_UPSTREAM_REVISION.slice(0, 12)})`,
      ephemerisDataVersion: SWISS_EPHEMERIS_DATA_VERSION,
      timeZoneDataVersion:
        "n/a: UTC-instant input only, no time-zone conversion performed",
      calculatedAt,
    };
  }
}

/** Parses one batched `-fPl` swetest run into integer microarcseconds. */
export function parseBatchOutput(stdout: string): Map<string, number> {
  const longitudes = new Map<string, number>();
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    const match = OUTPUT_LINE.exec(line);
    if (match === null) {
      throw new Error(
        `SwissEphemerisProvider: unparseable swetest line ${JSON.stringify(line)}`,
      );
    }
    const name = match[1].trim().toLowerCase();
    longitudes.set(
      name,
      normalizeLongitude(degreesToMicroarcseconds(Number(match[2]))),
    );
  }
  for (const expected of SWETEST_BODY_NAMES) {
    if (!longitudes.has(expected)) {
      throw new Error(
        `SwissEphemerisProvider: swetest output is missing ${expected}`,
      );
    }
  }
  return longitudes;
}
