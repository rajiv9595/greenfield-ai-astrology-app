/**
 * D1 (Rasi) chart engine tests (Phase 3D).
 *
 * Oracle discipline — the engine under test is never its own oracle:
 * - Independent oracle: the pinned swetest C binary (different codebase
 *   and language) for tropical/sidereal Ascendant geometry and TRUE
 *   ayanamsha (via tropical−sidereal Sun). Live-gated re-checks plus
 *   embedded anchors recorded from that binary for offline regression.
 * - Independent oracle: astro.com hosted swetest goldens
 *   (./swiss-ephemeris-golden.ts) for planetary longitudes.
 * - Documented convention (ADR-003) as oracle for sign/nakshatra/pada
 *   boundaries, whole-sign houses, and the mean-node opposition rule.
 *
 * (The former Phase 3C copy-fidelity guard was retired in the Phase 3E
 * consolidation: the duplicate test-support implementation it pinned no
 * longer exists, and the guard asserted nothing about accuracy. Phase 3C
 * accuracy validation now exercises the production ayanamsha module
 * directly against the independent oracles above.)
 *
 * Privacy: generic golden instants and the public Hyderabad fixture
 * coordinates (17.385 N, 78.4867 E, already in birth-input.test.ts)
 * only. No personal birth details anywhere in this file.
 */
import { execFile } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  D1_BODIES,
  birthInputToUtcInstant,
  birthInputToUtcMillis,
  computeD1Chart,
  signedDifferenceMicroarcseconds,
  utcMillisToJulianDayUt,
  type D1Body,
} from "../../packages/astrology-core/src/d1-chart";
import { tropicalAscendantDeg } from "../../packages/astrology-core/src/ascendant";
import {
  deltaTSeconds,
  nutation2000B,
  trueAyanamshaAtUt,
} from "../../packages/astrology-core/src/ayanamsha";
import {
  FULL_CIRCLE_MICROARCSECONDS,
  MICROARCSECONDS_PER_DEGREE,
  NAKSHATRA_WIDTH_MICROARCSECONDS,
  PADA_WIDTH_MICROARCSECONDS,
  SIGN_WIDTH_MICROARCSECONDS,
} from "../../packages/astrology-core/src/constants";
import { V1_CONFIGURATION } from "../../packages/astrology-core/src/configuration";
import type {
  BirthInput,
  EphemerisProvider,
} from "../../packages/astrology-core/src/types";
import {
  ASTRO_TOLERANCE_DEG,
  GOLDEN_INSTANTS,
} from "./swiss-ephemeris-golden";

/** Geometry agreement for a fresh implementation vs C binary. */
const TROP_GEOMETRY_TOLERANCE_DEG = 1 / 3600;
/** Sidereal conversion agreement (adds ayanamsha transcription). */
const SIDEREAL_CONVERSION_TOLERANCE_DEG = 2 / 3600;

const LIVE = Boolean(process.env.SWEPH_BIN && process.env.SWEPH_EPHE_PATH);

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

function parseAscendant(stdout: string): number {
  for (const rawLine of stdout.split("\n")) {
    const match = /^Ascendant\s+(-?\d+(?:\.\d+)?)/.exec(rawLine.trim());
    if (match !== null) return Number(match[1]);
  }
  throw new Error("swetest output is missing the Ascendant line");
}

function parseSun(stdout: string): number {
  for (const rawLine of stdout.split("\n")) {
    const match = /^Sun\s+(-?\d+(?:\.\d+)?)/.exec(rawLine.trim());
    if (match !== null) return Number(match[1]);
  }
  throw new Error("swetest output is missing the Sun line");
}

/**
 * House-geometry anchors recorded 2026-10-14 from the pinned binary
 * (swetest 2.10.03, upstream aacf962d) at generic golden instants with
 * the public fixture coordinates lat 17.385, lon 78.4867:
 *   swetest -edir<ephe> -eswe [-sid1] -ut -bj<jdUt,9dp>
 *     -house78.4867,17.385,P -fPlh -ep -head        -> Ascendant
 *   swetest -edir<ephe> -eswe [-sid1] -ut -bj<jdUt> -p0 -fPl -ep -head
 *                                             -> Sun (TRUE = trop − sid)
 */
const HOUSE_ANCHORS = [
  {
    label: "A/2000-01-01T12:00:00Z",
    julianDayUt: 2451545.0,
    tropicalAscendant: 96.14360274008,
    siderealAscendant: 72.29038025405,
    trueAyanamsha: 23.85322248603,
  },
  {
    label: "B/1990-04-21T09:00:00Z",
    julianDayUt: 2448002.875,
    tropicalAscendant: 153.95320863387,
    siderealAscendant: 130.22838083092,
    trueAyanamsha: 23.72482780296,
  },
  {
    label: "C/2024-02-29T18:30:00Z",
    julianDayUt: 2460370.270833334,
    tropicalAscendant: 240.56873701418,
    siderealAscendant: 216.37535101058,
    trueAyanamsha: 24.1933860036,
  },
] as const;

const FIXTURE_LAT = 17.385;
const FIXTURE_LON = 78.4867;

function nutationAtUt(julianDayUt: number): {
  readonly dpsiDeg: number;
  readonly depsDeg: number;
} {
  return nutation2000B(julianDayUt + deltaTSeconds(julianDayUt) / 86400);
}

function angularDifferenceDeg(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** Minimal deterministic stub behind the provider-neutral contract. */
class StubProvider implements EphemerisProvider {
  readonly id = "stub-provider";
  readonly dataVersion = "stub-1";

  constructor(
    private readonly at: (utcInstant: string, body: string) => number,
  ) {}

  async positionAt(
    utcInstant: string,
    body: string,
  ): Promise<{ longitudeMicroarcseconds: number; providerBodyId: string }> {
    return {
      longitudeMicroarcseconds: this.at(utcInstant, body),
      providerBodyId: `stub:${body}`,
    };
  }
}

function constantStub(
  longitudesMicroarcseconds: Record<string, number>,
): StubProvider {
  return new StubProvider((_instant, body) => {
    const value = longitudesMicroarcseconds[body];
    if (value === undefined) throw new Error(`stub has no ${body}`);
    return value;
  });
}

function degToMicroarcseconds(degrees: number): number {
  return Math.round(degrees * MICROARCSECONDS_PER_DEGREE);
}

describe("d1-chart time conversion (offline)", () => {
  it("converts the public IST fixture to the golden UTC instant", () => {
    const input: BirthInput = {
      localDateTime: "1990-04-21T14:30:00",
      timeZone: "Asia/Kolkata",
      latitude: FIXTURE_LAT,
      longitude: FIXTURE_LON,
      timePrecision: "exact",
    };
    expect(birthInputToUtcInstant(input)).toBe("1990-04-21T09:00:00.000Z");
    expect(utcMillisToJulianDayUt(birthInputToUtcMillis(input))).toBeCloseTo(
      2448002.875,
      9,
    );
  });

  it("handles seconds and a DST-observing zone", () => {
    const winter: BirthInput = {
      localDateTime: "2000-01-01T12:00:00",
      timeZone: "America/New_York",
      latitude: 40.7128,
      longitude: -74.006,
      timePrecision: "exact",
    };
    expect(birthInputToUtcInstant(winter)).toBe("2000-01-01T17:00:00.000Z");
    const summer: BirthInput = {
      localDateTime: "2000-07-01T12:00:00",
      timeZone: "America/New_York",
      latitude: 40.7128,
      longitude: -74.006,
      timePrecision: "exact",
    };
    expect(birthInputToUtcInstant(summer)).toBe("2000-07-01T16:00:00.000Z");
  });

  it("rejects ambiguous zones, bad coordinates, and zone gaps", () => {
    const valid: BirthInput = {
      localDateTime: "1990-04-21T14:30:00",
      timeZone: "Asia/Kolkata",
      latitude: FIXTURE_LAT,
      longitude: FIXTURE_LON,
      timePrecision: "exact",
    };
    expect(() =>
      birthInputToUtcInstant({ ...valid, timeZone: "IST" }),
    ).toThrow("named IANA");
    expect(() =>
      birthInputToUtcInstant({ ...valid, latitude: 91 }),
    ).toThrow("latitude");
    expect(() =>
      birthInputToUtcInstant({
        localDateTime: "2024-03-10T02:30:00",
        timeZone: "America/New_York",
        latitude: 40.7128,
        longitude: -74.006,
        timePrecision: "exact",
      }),
    ).toThrow("does not exist");
  });
});

describe("d1-chart Ascendant geometry vs pinned-binary anchors (offline)", () => {
  it("reproduces the independent tropical Ascendant to 1 arcsec", () => {
    for (const anchor of HOUSE_ANCHORS) {
      const nutation = nutationAtUt(anchor.julianDayUt);
      const actual = tropicalAscendantDeg(
        anchor.julianDayUt,
        FIXTURE_LAT,
        FIXTURE_LON,
        nutation.dpsiDeg,
        nutation.depsDeg,
      );
      expect(
        Math.abs(actual.ascendantDeg - anchor.tropicalAscendant) * 3600,
        `${anchor.label}: tropical Ascendant`,
      ).toBeLessThanOrEqual(TROP_GEOMETRY_TOLERANCE_DEG * 3600);
    }
  });

  it("reproduces the independent TRUE ayanamsha to 2 arcsec", () => {
    for (const anchor of HOUSE_ANCHORS) {
      expect(
        Math.abs(trueAyanamshaAtUt(anchor.julianDayUt) - anchor.trueAyanamsha) *
          3600,
        `${anchor.label}: TRUE ayanamsha`,
      ).toBeLessThanOrEqual(SIDEREAL_CONVERSION_TOLERANCE_DEG * 3600);
    }
  });

  it("converts tropical to the independent sidereal Ascendant to 2 arcsec", () => {
    for (const anchor of HOUSE_ANCHORS) {
      const nutation = nutationAtUt(anchor.julianDayUt);
      const tropical = tropicalAscendantDeg(
        anchor.julianDayUt,
        FIXTURE_LAT,
        FIXTURE_LON,
        nutation.dpsiDeg,
        nutation.depsDeg,
      );
      const sidereal =
        ((tropical.ascendantDeg - trueAyanamshaAtUt(anchor.julianDayUt)) %
          360 +
          360) %
        360;
      expect(
        angularDifferenceDeg(sidereal, anchor.siderealAscendant) * 3600,
        `${anchor.label}: sidereal Ascendant`,
      ).toBeLessThanOrEqual(SIDEREAL_CONVERSION_TOLERANCE_DEG * 3600);
    }
  });
});

describe("d1-chart boundaries, houses, and opposition (offline stubs)", () => {
  const baseInput: BirthInput = {
    localDateTime: "2000-01-01T17:30:00",
    timeZone: "Asia/Kolkata",
    latitude: FIXTURE_LAT,
    longitude: FIXTURE_LON,
    timePrecision: "exact",
  };

  function chartLongitudes(): Record<string, number> {
    const at: Record<string, number> = {};
    for (const body of D1_BODIES) at[body] = degToMicroarcseconds(100);
    return at;
  }

  it("uses left-inclusive sign boundaries and wraps at 0/360", async () => {
    for (const [longitude, expectedSign] of [
      [SIGN_WIDTH_MICROARCSECONDS - 1, 0],
      [SIGN_WIDTH_MICROARCSECONDS, 1],
      [FULL_CIRCLE_MICROARCSECONDS - 1, 11],
      [0, 0],
    ] as const) {
      const at = chartLongitudes();
      at["sun"] = longitude;
      const chart = await computeD1Chart(
        baseInput,
        constantStub(at),
        V1_CONFIGURATION,
        { calculatedAt: "2026-10-14T00:00:00.000Z" },
      );
      expect(chart.placements["sun"].signIndex).toBe(expectedSign);
      if (expectedSign === 1) {
        expect(
          chart.placements["sun"].degreeInSignMicroarcseconds,
        ).toBe(0);
      }
    }
  });

  it("uses left-inclusive nakshatra and pada boundaries", async () => {
    for (const [longitude, nakshatra, pada] of [
      [NAKSHATRA_WIDTH_MICROARCSECONDS - 1, 0, 3],
      [NAKSHATRA_WIDTH_MICROARCSECONDS, 1, 4],
      [PADA_WIDTH_MICROARCSECONDS - 1, 0, 0],
      [PADA_WIDTH_MICROARCSECONDS, 0, 1],
    ] as const) {
      const at = chartLongitudes();
      at["moon"] = longitude;
      const chart = await computeD1Chart(
        baseInput,
        constantStub(at),
        V1_CONFIGURATION,
        { calculatedAt: "2026-10-14T00:00:00.000Z" },
      );
      expect(chart.placements["moon"].nakshatraIndex).toBe(nakshatra);
      expect(chart.placements["moon"].padaIndex % 4).toBe(pada % 4);
      expect(chart.placements["moon"].padaNumber).toBe((pada % 4) + 1);
    }
  });

  it("assigns whole-sign houses from the Ascendant sign", async () => {
    const at = chartLongitudes();
    // Ascendant sign is read from the engine output, not assumed here.
    const probe = await computeD1Chart(
      baseInput,
      constantStub(at),
      V1_CONFIGURATION,
      { calculatedAt: "2026-10-14T00:00:00.000Z" },
    );
    const ascSign = probe.ascendant.signIndex;
    for (const offset of [0, 1, 5, 11] as const) {
      const at2 = chartLongitudes();
      at2["mars"] =
        (((ascSign + offset) % 12) * SIGN_WIDTH_MICROARCSECONDS +
          1_000_000_000) %
        FULL_CIRCLE_MICROARCSECONDS;
      const chart = await computeD1Chart(
        baseInput,
        constantStub(at2),
        V1_CONFIGURATION,
        { calculatedAt: "2026-10-14T00:00:00.000Z" },
      );
      expect(chart.placements["mars"].house).toBe(offset + 1);
    }
  });

  it("keeps Rahu and Ketu exactly opposite, including across 0 deg", async () => {
    for (const rahuDeg of [5, 180, 350] as const) {
      const rahu = degToMicroarcseconds(rahuDeg);
      const ketu =
        (rahu + FULL_CIRCLE_MICROARCSECONDS / 2) %
        FULL_CIRCLE_MICROARCSECONDS;
      const at = chartLongitudes();
      at["rahu"] = rahu;
      at["ketu"] = ketu;
      const chart = await computeD1Chart(
        baseInput,
        constantStub(at),
        V1_CONFIGURATION,
        { calculatedAt: "2026-10-14T00:00:00.000Z" },
      );
      expect(
        signedDifferenceMicroarcseconds(
          chart.placements["rahu"].longitudeMicroarcseconds,
          chart.placements["ketu"].longitudeMicroarcseconds,
        ),
      ).toBe(FULL_CIRCLE_MICROARCSECONDS / 2);
    }
  });

  it("measures retrograde from provider motion, never from a sign", async () => {
    const baseMillis = Date.parse("2000-01-01T12:00:00.000Z");
    const provider = new StubProvider((utcInstant, body) => {
      const days =
        (Date.parse(utcInstant) - baseMillis) / 86_400_000;
      const rate = body === "saturn" ? -0.05 : 1.0;
      const deg = ((100 + rate * days) % 360 + 360) % 360;
      return degToMicroarcseconds(deg);
    });
    const chart = await computeD1Chart(
      {
        localDateTime: "2000-01-01T17:30:00",
        timeZone: "Asia/Kolkata",
        latitude: FIXTURE_LAT,
        longitude: FIXTURE_LON,
        timePrecision: "exact",
      },
      provider,
      V1_CONFIGURATION,
      { calculatedAt: "2026-10-14T00:00:00.000Z" },
    );
    expect(chart.placements["saturn"].retrograde).toBe(true);
    expect(chart.placements["sun"].retrograde).toBe(false);
    expect(chart.placements["moon"].retrograde).toBe(false);
  });

  it("is deterministic for identical inputs", async () => {
    const options = { calculatedAt: "2026-10-14T00:00:00.000Z" };
    const first = await computeD1Chart(
      baseInput,
      constantStub(chartLongitudes()),
      V1_CONFIGURATION,
      options,
    );
    const second = await computeD1Chart(
      baseInput,
      constantStub(chartLongitudes()),
      V1_CONFIGURATION,
      options,
    );
    expect(second).toEqual(first);
  });

  it("rejects bad inputs, configurations, providers, and responses", async () => {
    const stub = constantStub(chartLongitudes());
    await expect(
      computeD1Chart(
        { ...baseInput, latitude: 90 },
        stub,
        V1_CONFIGURATION,
      ),
    ).rejects.toThrow("poles undefined");
    await expect(
      computeD1Chart(baseInput, stub, {
        ...V1_CONFIGURATION,
        ayanamsha: "raman" as never,
      }),
    ).rejects.toThrow("only the V1 configuration");
    await expect(
      computeD1Chart(
        baseInput,
        null as unknown as EphemerisProvider,
        V1_CONFIGURATION,
      ),
    ).rejects.toThrow("provider is required");
    const failing = new StubProvider(() => {
      throw new Error("stub binary failed");
    });
    await expect(
      computeD1Chart(baseInput, failing, V1_CONFIGURATION),
    ).rejects.toThrow("stub binary failed");
    for (const bad of [
      FULL_CIRCLE_MICROARCSECONDS,
      -1,
      0.5,
      Number.NaN,
    ]) {
      const at = chartLongitudes();
      at["sun"] = bad;
      await expect(
        computeD1Chart(baseInput, constantStub(at), V1_CONFIGURATION),
      ).rejects.toThrow("invalid provider longitude");
    }
  });
});

describe.skipIf(!LIVE)("d1-chart live verification (pinned binary oracle)", () => {
  it("matches fresh tropical/sidereal house Ascendants", async () => {
    for (const anchor of HOUSE_ANCHORS) {
      const jd = anchor.julianDayUt.toFixed(9);
      const tropical = await runSwetestRaw([
        "-ut",
        `-bj${jd}`,
        `-house${FIXTURE_LON},${FIXTURE_LAT},P`,
        "-fPlh",
        "-ep",
        "-head",
      ]);
      const sidereal = await runSwetestRaw([
        "-sid1",
        "-ut",
        `-bj${jd}`,
        `-house${FIXTURE_LON},${FIXTURE_LAT},P`,
        "-fPlh",
        "-ep",
        "-head",
      ]);
      const nutation = nutationAtUt(anchor.julianDayUt);
      const mine = tropicalAscendantDeg(
        anchor.julianDayUt,
        FIXTURE_LAT,
        FIXTURE_LON,
        nutation.dpsiDeg,
        nutation.depsDeg,
      );
      expect(
        Math.abs(mine.ascendantDeg - parseAscendant(tropical)) * 3600,
        `${anchor.label}: live tropical`,
      ).toBeLessThanOrEqual(TROP_GEOMETRY_TOLERANCE_DEG * 3600);
      const mineSidereal =
        ((mine.ascendantDeg - trueAyanamshaAtUt(anchor.julianDayUt)) % 360 +
          360) %
        360;
      expect(
        angularDifferenceDeg(mineSidereal, parseAscendant(sidereal)) * 3600,
        `${anchor.label}: live sidereal`,
      ).toBeLessThanOrEqual(SIDEREAL_CONVERSION_TOLERANCE_DEG * 3600);
    }
  });

  it("matches the adapter-implied TRUE ayanamsha from fresh runs", async () => {
    for (const anchor of HOUSE_ANCHORS) {
      const jd = anchor.julianDayUt.toFixed(9);
      const tropical = await runSwetestRaw([
        "-ut",
        `-bj${jd}`,
        "-p0",
        "-fPl",
        "-ep",
        "-head",
      ]);
      const sidereal = await runSwetestRaw([
        "-sid1",
        "-ut",
        `-bj${jd}`,
        "-p0",
        "-fPl",
        "-ep",
        "-head",
      ]);
      const implied =
        ((parseSun(tropical) - parseSun(sidereal)) % 360 + 360) % 360;
      expect(
        angularDifferenceDeg(trueAyanamshaAtUt(anchor.julianDayUt), implied) *
          3600,
        `${anchor.label}: live TRUE`,
      ).toBeLessThanOrEqual(SIDEREAL_CONVERSION_TOLERANCE_DEG * 3600);
    }
  });

  it("places every graha at the astro.com golden longitudes", async () => {
    const { SwissEphemerisProvider } = await import(
      "../../packages/swiss-ephemeris/src/provider"
    );
    const provider = new SwissEphemerisProvider({
      swetestPath: swetestPath(),
      ephePath: ephePath(),
    });
    const localFor = (utcInstant: string): string => {
      const millis = Date.parse(utcInstant) + 5.5 * 3_600_000;
      const date = new Date(millis);
      const pad = (n: number): string => String(n).padStart(2, "0");
      return (
        `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
        `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
      );
    };
    for (const golden of GOLDEN_INSTANTS) {
      const chart = await computeD1Chart(
        {
          localDateTime: localFor(golden.utcInstant),
          timeZone: "Asia/Kolkata",
          latitude: FIXTURE_LAT,
          longitude: FIXTURE_LON,
          timePrecision: "exact",
        },
        provider,
        V1_CONFIGURATION,
        { calculatedAt: "2026-10-14T00:00:00.000Z" },
      );
      expect(chart.utcInstant).toBe(
        new Date(golden.utcInstant).toISOString(),
      );
      for (const body of D1_BODIES) {
        const actual =
          chart.placements[body as D1Body].longitudeMicroarcseconds /
          MICROARCSECONDS_PER_DEGREE;
        const expected =
          body === "ketu"
            ? (golden.astroSidereal["rahu"] + 180) % 360
            : golden.astroSidereal[body];
        expect(
          angularDifferenceDeg(actual, expected),
          `${golden.label} ${body}`,
        ).toBeLessThanOrEqual(ASTRO_TOLERANCE_DEG);
      }
      expect(
        signedDifferenceMicroarcseconds(
          chart.placements["rahu"].longitudeMicroarcseconds,
          chart.placements["ketu"].longitudeMicroarcseconds,
        ),
      ).toBe(FULL_CIRCLE_MICROARCSECONDS / 2);
    }
  });

  it("measures Saturn retrograde at J2000 and direct Sun/Moon", async () => {
    const { SwissEphemerisProvider } = await import(
      "../../packages/swiss-ephemeris/src/provider"
    );
    const provider = new SwissEphemerisProvider({
      swetestPath: swetestPath(),
      ephePath: ephePath(),
    });
    const chart = await computeD1Chart(
      {
        localDateTime: "2000-01-01T17:30:00",
        timeZone: "Asia/Kolkata",
        latitude: FIXTURE_LAT,
        longitude: FIXTURE_LON,
        timePrecision: "exact",
      },
      provider,
      V1_CONFIGURATION,
      { calculatedAt: "2026-10-14T00:00:00.000Z" },
    );
    expect(chart.placements["saturn"].retrograde).toBe(true);
    expect(chart.placements["sun"].retrograde).toBe(false);
    expect(chart.placements["moon"].retrograde).toBe(false);
  });
});
