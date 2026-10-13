import { describe, expect, it } from "vitest";
import { normalizeLongitude } from "../../packages/astrology-core/src/boundaries";
import { V1_CONFIGURATION } from "../../packages/astrology-core/src/configuration";
import { FULL_CIRCLE_MICROARCSECONDS } from "../../packages/astrology-core/src/constants";
import {
  SwissEphemerisProvider,
  degreesToMicroarcseconds,
  utcInstantToJulianDay,
} from "../../packages/swiss-ephemeris/src/provider";
import { GOLDEN_INSTANTS } from "./swiss-ephemeris-golden";

const LIVE = Boolean(process.env.SWEPH_BIN && process.env.SWEPH_EPHE_PATH);

function liveProvider(): SwissEphemerisProvider {
  return new SwissEphemerisProvider({
    swetestPath: process.env.SWEPH_BIN,
    ephePath: process.env.SWEPH_EPHE_PATH,
  });
}

function stubProvider(): SwissEphemerisProvider {
  return new SwissEphemerisProvider({
    swetestPath: "<unconfigured-swetest>",
    ephePath: "<unconfigured-ephe>",
  });
}

describe("swiss-ephemeris adapter pure conversions", () => {
  it("converts UTC instants to Julian Day numbers", () => {
    for (const golden of GOLDEN_INSTANTS) {
      expect(utcInstantToJulianDay(golden.utcInstant)).toBeCloseTo(
        golden.julianDayUt,
        9,
      );
    }
    expect(utcInstantToJulianDay("2000-01-01T12:00:00Z")).toBe(2451545.0);
  });

  it("rejects invalid UTC instants before spawning anything", () => {
    expect(() => utcInstantToJulianDay("not-a-date")).toThrow("invalid UTC instant");
    expect(() => utcInstantToJulianDay("")).toThrow("invalid UTC instant");
  });

  it("quantizes degrees to integer microarcseconds", () => {
    expect(degreesToMicroarcseconds(256.51569618387)).toBe(923456506262);
    expect(degreesToMicroarcseconds(0)).toBe(0);
    expect(() => degreesToMicroarcseconds(Number.NaN)).toThrow("not finite");
  });

  it("requires explicit binary and data paths (fail closed)", () => {
    const savedBin = process.env.SWEPH_BIN;
    const savedEphe = process.env.SWEPH_EPHE_PATH;
    delete process.env.SWEPH_BIN;
    delete process.env.SWEPH_EPHE_PATH;
    try {
      expect(() => new SwissEphemerisProvider()).toThrow("SWEPH_BIN");
      expect(
        () => new SwissEphemerisProvider({ swetestPath: "/bin/x" }),
      ).toThrow("SWEPH_EPHE_PATH");
    } finally {
      if (savedBin !== undefined) process.env.SWEPH_BIN = savedBin;
      if (savedEphe !== undefined) process.env.SWEPH_EPHE_PATH = savedEphe;
    }
  });

  it("rejects unknown bodies without calling the binary", async () => {
    await expect(
      stubProvider().positionAt("2000-01-01T12:00:00Z", "pluto", V1_CONFIGURATION),
    ).rejects.toThrow("unsupported body");
  });

  it("rejects non-V1 configurations instead of mixing conventions", async () => {
    await expect(
      stubProvider().positionAt("2000-01-01T12:00:00Z", "sun", {
        ...V1_CONFIGURATION,
        ayanamsha: "raman" as never,
      }),
    ).rejects.toThrow("only the V1 configuration");
  });

  it("rejects invalid instants without calling the binary", async () => {
    await expect(
      stubProvider().positionAt("yesterday", "sun", V1_CONFIGURATION),
    ).rejects.toThrow("invalid UTC instant");
  });

  it("surfaces binary execution failures as errors", async () => {
    await expect(
      stubProvider().positionAt(
        "2000-01-01T12:00:00Z",
        "sun",
        V1_CONFIGURATION,
      ),
    ).rejects.toThrow("swetest failed");
  });
});

describe.skipIf(!LIVE)("swiss-ephemeris adapter live calculations", () => {
  it("returns deterministic integer microarcseconds for all bodies", async () => {
    const provider = liveProvider();
    for (const body of [
      "sun",
      "moon",
      "mercury",
      "venus",
      "mars",
      "jupiter",
      "saturn",
      "rahu",
      "ketu",
    ] as const) {
      const first = await provider.positionAt(
        "2000-01-01T12:00:00Z",
        body,
        V1_CONFIGURATION,
      );
      const second = await provider.positionAt(
        "2000-01-01T12:00:00Z",
        body,
        V1_CONFIGURATION,
      );
      expect(first.longitudeMicroarcseconds).toBe(
        second.longitudeMicroarcseconds,
      );
      expect(Number.isSafeInteger(first.longitudeMicroarcseconds)).toBe(true);
      expect(first.longitudeMicroarcseconds).toBeGreaterThanOrEqual(0);
      expect(first.longitudeMicroarcseconds).toBeLessThan(
        FULL_CIRCLE_MICROARCSECONDS,
      );
    }
  });

  it("derives Ketu as exactly Rahu plus 180 degrees", async () => {
    const provider = liveProvider();
    const rahu = await provider.positionAt(
      "2000-01-01T12:00:00Z",
      "rahu",
      V1_CONFIGURATION,
    );
    const ketu = await provider.positionAt(
      "2000-01-01T12:00:00Z",
      "ketu",
      V1_CONFIGURATION,
    );
    expect(ketu.longitudeMicroarcseconds).toBe(
      normalizeLongitude(rahu.longitudeMicroarcseconds + 648_000_000_000),
    );
    expect(ketu.providerBodyId).toContain("derived");
  });

  it("observes retrograde motion as decreasing longitude over one day", async () => {
    // Saturn is retrograde around 2000-01-01 (negative daily motion).
    const provider = liveProvider();
    const dayOne = await provider.positionAt(
      "2000-01-01T12:00:00Z",
      "saturn",
      V1_CONFIGURATION,
    );
    const dayTwo = await provider.positionAt(
      "2000-01-02T12:00:00Z",
      "saturn",
      V1_CONFIGURATION,
    );
    expect(dayTwo.longitudeMicroarcseconds).toBeLessThan(
      dayOne.longitudeMicroarcseconds,
    );
  });

  it("handles the leap date without error", async () => {
    const provider = liveProvider();
    const moon = await provider.positionAt(
      "2024-02-29T18:30:00Z",
      "moon",
      V1_CONFIGURATION,
    );
    expect(Number.isSafeInteger(moon.longitudeMicroarcseconds)).toBe(true);
  });

  it("returns provenance pinned to the verified upstream revision", () => {
    const provenance = liveProvider().provenance("2026-10-13T00:00:00.000Z");
    expect(provenance.ephemerisProvider).toContain("swiss-ephemeris");
    expect(provenance.ephemerisProvider).toContain("aacf962d");
    expect(provenance.ephemerisDataVersion).toContain("DE441");
    expect(provenance.calculatedAt).toBe("2026-10-13T00:00:00.000Z");
  });
});
