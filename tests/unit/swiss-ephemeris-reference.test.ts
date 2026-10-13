/**
 * Independent reference tests for the pinned Swiss Ephemeris build.
 *
 * Two anchors, both obtained independently of the local MinGW binary:
 * 1. astro.com hosted swetest (same software, independent run/build/machine):
 *    sidereal Lahiri longitudes, mean node, and ayanamsha.
 * 2. JPL Horizons vectors (different software and data lineage: NASA DE441
 *    direct vs Swiss compressed .se1): J2000-frame ecliptic longitudes.
 *
 * Golden values and tolerances live in ./swiss-ephemeris-golden.ts.
 * Every test in this file requires the pinned binary (SWEPH_BIN /
 * SWEPH_EPHE_PATH); without it the suite skips instead of faking results.
 */
import { execFile } from "node:child_process";
import { describe, expect, it } from "vitest";
import { V1_CONFIGURATION } from "../../packages/astrology-core/src/configuration";
import { SwissEphemerisProvider } from "../../packages/swiss-ephemeris/src/provider";
import {
  ASTRO_TOLERANCE_DEG,
  AYANAMSHA_TOLERANCE_DEG,
  GOLDEN_INSTANTS,
  HORIZONS_TOLERANCE_DEG,
  SIDEREAL_IDENTITY_TOLERANCE_DEG,
  atan2Deg,
} from "./swiss-ephemeris-golden";

const LIVE = Boolean(process.env.SWEPH_BIN && process.env.SWEPH_EPHE_PATH);
const MICROARCSECONDS_PER_DEGREE = 3_600_000_000;

function swetestPath(): string {
  const path = process.env.SWEPH_BIN;
  if (!path) throw new Error("SWEPH_BIN is not configured");
  return path;
}

function ephePath(): string {
  const path = process.env.SWEPH_EPHE_PATH;
  if (!path) throw new Error("SWEPH_EPHE_PATH is not configured");
  return path;
}

/** Test-only direct spawn for non-adapter modes (J2000, ayanamsha, tropical). */
function runSwetestRaw(args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      swetestPath(),
      [`-edir${ephePath()}`, "-eswe", ...args],
      { timeout: 60_000, windowsHide: true },
      (error, stdout) => {
        if (error) {
          reject(new Error(`swetest failed (${error.message})`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/** Minimal name -> degrees parser for test-only raw runs. */
function parseLongitudes(stdout: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    const match = /^([A-Za-z][A-Za-z ]*?)\s+(-?\d+(?:\.\d+)?)\s*$/.exec(line);
    if (match === null) {
      throw new Error(`unparseable swetest line ${JSON.stringify(line)}`);
    }
    result.set(match[1].trim().toLowerCase(), Number(match[2]));
  }
  return result;
}

function angularDifferenceDeg(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function parseAyanamshaDms(stdout: string): number {
  // Degree glyph encoding varies by console; accept any single separator.
  const match = /Ayanamsha Lahiri\s+(\d+)\D\s*(\d+)'([\d.]+)/.exec(stdout);
  if (match === null) throw new Error("ayanamsha line not found");
  return (
    Number(match[1]) + Number(match[2]) / 60 + Number(match[3]) / 3600
  );
}

const ADAPTER_BODIES = [
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

const SWETEST_LETTERS: Record<string, string> = {
  sun: "0",
  moon: "1",
  mercury: "2",
  venus: "3",
  mars: "4",
  jupiter: "5",
  saturn: "6",
};

describe.skipIf(!LIVE)("swiss-ephemeris astro.com anchor", () => {
  it("matches the independent astro.com run for every golden instant", async () => {
    const provider = new SwissEphemerisProvider({
      swetestPath: swetestPath(),
      ephePath: ephePath(),
    });
    let worst = 0;
    for (const golden of GOLDEN_INSTANTS) {
      for (const body of ADAPTER_BODIES) {
        const position = await provider.positionAt(
          golden.utcInstant,
          body,
          V1_CONFIGURATION,
        );
        const actualDeg =
          position.longitudeMicroarcseconds / MICROARCSECONDS_PER_DEGREE;
        const expectedDeg =
          body === "ketu"
            ? (golden.astroSidereal["rahu"] + 180) % 360
            : golden.astroSidereal[body];
        const diff = angularDifferenceDeg(actualDeg, expectedDeg);
        worst = Math.max(worst, diff);
        expect(
          diff,
          `${golden.label} ${body}: adapter ${actualDeg} vs astro.com ${expectedDeg}`,
        ).toBeLessThanOrEqual(ASTRO_TOLERANCE_DEG);
      }
    }
    expect(worst).toBeGreaterThanOrEqual(0);
  });

  it("reports Lahiri ayanamsha matching astro.com", async () => {
    for (const golden of GOLDEN_INSTANTS) {
      const stdout = await runSwetestRaw([
        "-ut",
        // Same 9-decimal instant as the adapter: 6 decimals would shift
        // sub-day instants by up to ~0.05 s of time.
        `-bj${golden.julianDayUt.toFixed(9)}`,
        "-ay1",
        "-head",
      ]);
      const actual = parseAyanamshaDms(stdout);
      expect(
        Math.abs(actual - golden.astroAyanamshaDeg),
        `${golden.label}: ayanamsha ${actual} vs ${golden.astroAyanamshaDeg}`,
      ).toBeLessThanOrEqual(AYANAMSHA_TOLERANCE_DEG);
    }
  });

  it("satisfies sidereal = tropical - ayanamsha from the same binary", async () => {
    const provider = new SwissEphemerisProvider({
      swetestPath: swetestPath(),
      ephePath: ephePath(),
    });
    for (const golden of GOLDEN_INSTANTS) {
      const tropical = await runSwetestRaw([
        "-ut",
        `-bj${golden.julianDayUt.toFixed(9)}`,
        "-p0",
        "-fPl",
        "-ep",
        "-head",
      ]);
      const tropicalSun = parseLongitudes(tropical).get("sun");
      const sidereal = await provider.positionAt(
        golden.utcInstant,
        "sun",
        V1_CONFIGURATION,
      );
      const siderealSun =
        sidereal.longitudeMicroarcseconds / MICROARCSECONDS_PER_DEGREE;
      const expected =
        ((tropicalSun! - golden.astroAyanamshaDeg) % 360 + 360) % 360;
      expect(
        angularDifferenceDeg(siderealSun, expected),
        `${golden.label}: sidereal identity`,
      ).toBeLessThanOrEqual(SIDEREAL_IDENTITY_TOLERANCE_DEG);
    }
  });
});

describe.skipIf(!LIVE)("swiss-ephemeris JPL Horizons anchor", () => {
  it("matches JPL DE441 vectors within one arcsecond", async () => {
    for (const golden of GOLDEN_INSTANTS) {
      const bodies = Object.keys(golden.horizonsVectorsKm);
      const letters = bodies.map((body) => SWETEST_LETTERS[body]).join("");
      const stdout = await runSwetestRaw([
        "-noaberr",
        "-nodefl",
        "-nonut",
        "-j2000",
        "-ut",
        `-bj${golden.julianDayUt.toFixed(9)}`,
        `-p${letters}`,
        "-fPl",
        "-ep",
        "-head",
      ]);
      const actual = parseLongitudes(stdout);
      for (const body of bodies) {
        const [x, y] = golden.horizonsVectorsKm[body];
        const expected = atan2Deg(y, x);
        const diff = angularDifferenceDeg(actual.get(body)!, expected);
        expect(
          diff,
          `${golden.label} ${body}: swetest ${actual.get(body)} vs Horizons ${expected}`,
        ).toBeLessThanOrEqual(HORIZONS_TOLERANCE_DEG);
      }
    }
  });
});

describe("swiss-ephemeris pending verification", () => {
  it.todo(
    "first-principles Lahiri ayanamsha check from a different lineage " +
      "(current anchors: independent astro.com run + JPL Horizons vectors)",
  );
});
