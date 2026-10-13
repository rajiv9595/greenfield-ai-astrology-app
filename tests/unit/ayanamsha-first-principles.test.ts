/**
 * First-principles Lahiri ayanamsha verification (Phase 3C).
 *
 * The adapter's ayanamsha is checked against a fresh implementation of the
 * documented definition (./ayanamsha-theory.ts) instead of against itself:
 *
 *   CRC-1956 anchor: t0 = JD 2435553.5 TDT, ayan_t0 = 23.245524743° (mean),
 *   precessed under the published IAU 1976 theory; TRUE adds published
 *   IAU 2000B nutation.
 *
 * Layers (see theory file header for the circularity protocol):
 * L0 offline math checks (no binary): rotation sanity, roundtrips,
 *   published angle/JD/anchor spot values.
 * L1 transcription check (binary): my IAU2000B Δψ vs the binary's implied
 *   Δψ (TRUE − MEAN). Same published series both sides ⇒ 0.01" tolerance.
 * L2 first-principles MEAN (binary): my MEAN vs `-nonut` MEAN, 9 TT epochs.
 * L3 first-principles TRUE (binary): my TRUE vs adapter TRUE, 7 UTC epochs.
 * L4 literature anchors (binary + mine): printed IAE/IENA values.
 *
 * Golden epochs, ΔT, literature values, and tolerances:
 * ./ayanamsha-anchors.ts. No provider-interface change was needed: TRUE is
 * read through the real adapter path (tropical − sidereal Sun) and MEAN
 * through the pinned binary's `-nonut` mode, the same code the adapter
 * relies on for sidereal positions.
 */
import { execFile } from "node:child_process";
import { describe, expect, it } from "vitest";
import { V1_CONFIGURATION } from "../../packages/astrology-core/src/configuration";
import {
  SwissEphemerisProvider,
  utcInstantToJulianDay,
} from "../../packages/swiss-ephemeris/src/provider";
import {
  AYANAMSHA_EPOCHS,
  FIRST_PRINCIPLES_TOLERANCE_DEG,
  LITERATURE_ANCHORS,
  LITERATURE_TOLERANCE_DEG,
  NUTATION_TRANSCRIPTION_TOLERANCE_DEG,
  TRUE_TOLERANCE_DEG,
} from "./ayanamsha-anchors";
import { NUT2000B_ROWS, NUT2000B_TERM_COUNT } from "./ayanamsha-nut2000b";
import {
  LAHIRI_AYAN_T0_DEG,
  LAHIRI_AYAN_T0_HEADER_DECIMAL,
  LAHIRI_T0_JD,
  julianDayTT,
  nutation2000B,
  predictMeanAyanamsha,
  predictTrueAyanamsha,
  precessionAnglesIAU1976,
  precessionMatrixDateToJ2000,
  precessionMatrixJ2000ToDate,
  rotationZ,
} from "./ayanamsha-theory";

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

/** Test-only direct spawn (kept local so swiss-ephemeris-reference.test.ts stays untouched). */
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

function parseDecimalLine(stdout: string, wanted: string): number {
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    const match = /^([A-Za-z][A-Za-z ]*?)\s+(-?\d+(?:\.\d+)?)\s*$/.exec(line);
    if (match === null) {
      throw new Error(`unparseable swetest line ${JSON.stringify(line)}`);
    }
    if (match[1].trim().toLowerCase() === wanted) return Number(match[2]);
  }
  throw new Error(`swetest output is missing ${wanted}`);
}

function angularDifferenceDeg(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** Adapter-implied TRUE ayanamsha: tropical − sidereal Sun, full precision. */
async function adapterTrueAyanamsha(
  provider: SwissEphemerisProvider,
  utcInstant: string,
): Promise<number> {
  const tropical = await runSwetestRaw([
    "-ut",
    `-bj${utcInstantToJulianDay(utcInstant).toFixed(9)}`,
    "-p0",
    "-fPl",
    "-ep",
    "-head",
  ]);
  const tropicalSun = parseDecimalLine(tropical, "sun");
  const sidereal = await provider.positionAt(
    utcInstant,
    "sun",
    V1_CONFIGURATION,
  );
  const siderealSun =
    sidereal.longitudeMicroarcseconds / MICROARCSECONDS_PER_DEGREE;
  return ((tropicalSun - siderealSun) % 360 + 360) % 360;
}

/** Pinned-binary MEAN ayanamsha at a TT instant (pure TT path, no ΔT). */
async function binaryMeanAyanamsha(julianDayTt: number): Promise<number> {
  const stdout = await runSwetestRaw([
    `-bj${julianDayTt.toFixed(6)}`,
    "-pb",
    "-sid1",
    "-fPl",
    "-ep",
    "-nonut",
    "-head",
  ]);
  return parseDecimalLine(stdout, "ayanamsha");
}

describe("ayanamsha theory L0: math self-checks (offline)", () => {
  it("encodes the published IAU 1976 precession angles", () => {
    // Lieske et al. 1977 polynomials evaluated at T = 1 Julian century.
    const angles = precessionAnglesIAU1976(1);
    const toArcsec = (r: number): number =>
      (r * 180) / Math.PI * 3600;
    expect(toArcsec(angles.zeta)).toBeCloseTo(2306.537978, 3);
    expect(toArcsec(angles.z)).toBeCloseTo(2307.330983, 3);
    expect(toArcsec(angles.theta)).toBeCloseTo(2003.842417, 3);
  });

  it("applies right-handed rotations and inverts precession exactly", () => {
    const z90 = rotationZ(Math.PI / 2);
    expect(z90[0][0]).toBeCloseTo(0, 15);
    expect(z90[0][1]).toBeCloseTo(1, 15);
    expect(z90[1][0]).toBeCloseTo(-1, 15);
    for (const jd of [2415020.5, 2451545.0, 2462502.5]) {
      const p = precessionMatrixJ2000ToDate(jd);
      const inv = precessionMatrixDateToJ2000(jd);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let k = 0; k < 3; k++) sum += p[r][k] * inv[k][c];
          expect(sum).toBeCloseTo(r === c ? 1 : 0, 12);
        }
      }
    }
  });

  it("computes canonical Julian Days including the anchor epoch", () => {
    expect(julianDayTT(2000, 1, 1, 12)).toBe(2451545.0);
    expect(julianDayTT(1970, 1, 1, 0)).toBe(2440587.5);
    expect(julianDayTT(1900, 1, 1, 0)).toBe(2415020.5);
    expect(julianDayTT(1989, 1, 1, 0)).toBe(2447527.5);
    expect(julianDayTT(1990, 1, 1, 0)).toBe(2447892.5);
    // The CRC-1956 anchor epoch: procedure identity is exact there.
    expect(julianDayTT(1956, 3, 21, 0)).toBe(LAHIRI_T0_JD);
  });

  it("transcribes the anchor constant exactly", () => {
    // DMS form vs header decimal agree to ~2e-10 deg (0.001 mas); both are
    // far below any physical tolerance, so precision 9 is the honest check.
    expect(LAHIRI_AYAN_T0_DEG).toBeCloseTo(LAHIRI_AYAN_T0_HEADER_DECIMAL, 9);
    expect(predictMeanAyanamsha(LAHIRI_T0_JD)).toBeCloseTo(
      LAHIRI_AYAN_T0_DEG,
      9,
    );
  });

  it("keeps the nutation series table intact (77 IAU2000B terms)", () => {
    expect(NUT2000B_TERM_COUNT).toBe(77);
    expect(NUT2000B_ROWS).toHaveLength(77);
    expect(NUT2000B_ROWS[0].slice(0, 5)).toEqual([0, 0, 0, 0, 1]);
  });

  it("produces a sane nutation sign and magnitude at J2000", () => {
    // Order check only (principal −17.2"·sin Ω with Ω ≈ 125° ⇒ ≈ −14",
    // plus smaller terms); catches unit/sign/gross errors. Precision is
    // established by L1/L3, not here.
    const { dpsiDeg } = nutation2000B(2451545.0);
    expect(dpsiDeg).toBeGreaterThan(-20 / 3600);
    expect(dpsiDeg).toBeLessThan(-5 / 3600);
  });
});

describe.skipIf(!LIVE)("ayanamsha theory L2: first-principles MEAN", () => {
  it("matches the pinned binary MEAN to 2 arcsec over 1900–2030", async () => {
    for (const epoch of AYANAMSHA_EPOCHS) {
      const mine = predictMeanAyanamsha(epoch.julianDayTt);
      const binary = await binaryMeanAyanamsha(epoch.julianDayTt);
      expect(
        angularDifferenceDeg(mine, binary),
        `${epoch.label}: mine ${mine} vs binary MEAN ${binary}`,
      ).toBeLessThanOrEqual(FIRST_PRINCIPLES_TOLERANCE_DEG);
    }
  });
});

describe.skipIf(!LIVE)("ayanamsha theory L3: first-principles TRUE", () => {
  it("matches the adapter TRUE to 2 arcsec over 1900–2030", async () => {
    const provider = new SwissEphemerisProvider({
      swetestPath: swetestPath(),
      ephePath: ephePath(),
    });
    for (const epoch of AYANAMSHA_EPOCHS) {
      const jdUt = utcInstantToJulianDay(epoch.utcInstant);
      const jdTt = jdUt + epoch.deltaTSeconds / 86400;
      const mine = predictTrueAyanamsha(jdTt);
      const adapter = await adapterTrueAyanamsha(provider, epoch.utcInstant);
      expect(
        angularDifferenceDeg(mine, adapter),
        `${epoch.label}: mine ${mine} vs adapter TRUE ${adapter}`,
      ).toBeLessThanOrEqual(TRUE_TOLERANCE_DEG);
    }
  });
});

describe.skipIf(!LIVE)("ayanamsha theory L4: printed literature anchors", () => {
  it("agrees with independent publications to 2 arcsec", async () => {
    const provider = new SwissEphemerisProvider({
      swetestPath: swetestPath(),
      ephePath: ephePath(),
    });
    for (const anchor of LITERATURE_ANCHORS) {
      if (anchor.kind === "mean") {
        const mine = predictMeanAyanamsha(anchor.julianDayTt);
        const binary = await binaryMeanAyanamsha(anchor.julianDayTt);
        expect(
          angularDifferenceDeg(mine, anchor.valueDeg),
          `${anchor.label}: mine ${mine} vs published ${anchor.valueDeg}`,
        ).toBeLessThanOrEqual(LITERATURE_TOLERANCE_DEG);
        expect(
          angularDifferenceDeg(binary, anchor.valueDeg),
          `${anchor.label}: binary ${binary} vs published ${anchor.valueDeg}`,
        ).toBeLessThanOrEqual(LITERATURE_TOLERANCE_DEG);
      } else {
        // TRUE anchors are Jan-1 based; the adapter path is UTC-native
        // and mine uses TT = UT + ΔT (epoch ambiguity ≪ tolerance).
        const utcInstant = anchor.label.includes("2019")
          ? "2019-01-01T00:00:00Z"
          : "2000-01-01T00:00:00Z";
        const deltaT = anchor.label.includes("2019") ? 69.2 : 63.83;
        const mine = predictTrueAyanamsha(
          utcInstantToJulianDay(utcInstant) + deltaT / 86400,
        );
        const adapter = await adapterTrueAyanamsha(provider, utcInstant);
        expect(
          angularDifferenceDeg(mine, anchor.valueDeg),
          `${anchor.label}: mine ${mine} vs published ${anchor.valueDeg}`,
        ).toBeLessThanOrEqual(LITERATURE_TOLERANCE_DEG);
        expect(
          angularDifferenceDeg(adapter, anchor.valueDeg),
          `${anchor.label}: adapter ${adapter} vs published ${anchor.valueDeg}`,
        ).toBeLessThanOrEqual(LITERATURE_TOLERANCE_DEG);
      }
    }
  });
});
describe.skipIf(!LIVE)("ayanamsha theory L1: nutation transcription", () => {
  it("matches the binary's implied nutation to 0.01 arcsec", async () => {
    const provider = new SwissEphemerisProvider({
      swetestPath: swetestPath(),
      ephePath: ephePath(),
    });
    for (const epoch of AYANAMSHA_EPOCHS) {
      const jdUt = utcInstantToJulianDay(epoch.utcInstant);
      const jdTt = jdUt + epoch.deltaTSeconds / 86400;
      const trueAya = await adapterTrueAyanamsha(provider, epoch.utcInstant);
      // MEAN TT epoch and TRUE TT differ by ΔT seconds (≤1.2e-4" of drift).
      const meanAya = await binaryMeanAyanamsha(epoch.julianDayTt);
      const impliedDpsi = ((trueAya - meanAya) % 360 + 360) % 360;
      const wrapped = impliedDpsi > 180 ? impliedDpsi - 360 : impliedDpsi;
      const mine = nutation2000B(jdTt).dpsiDeg;
      expect(
        Math.abs(wrapped - mine),
        `${epoch.label}: my Δψ ${mine} vs implied ${wrapped}`,
      ).toBeLessThanOrEqual(NUTATION_TRANSCRIPTION_TOLERANCE_DEG);
    }
  });
});
