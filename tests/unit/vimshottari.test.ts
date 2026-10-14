/**
 * Vimshottari Mahadasha/Antardasha engine tests (Phase 3E, ADR-005).
 *
 * Oracle discipline:
 * - INDEPENDENT hand-arithmetic references: expected millisecond values
 *   below are literals worked by hand from ADR-005 (lord years ×
 *   31,557,600,000 ms/year, i.e. years × 365.25 × 86,400,000) and
 *   cross-checked with a desk calculator during test authoring. The
 *   engine under test uses a different evaluation path (exact BigInt
 *   rational rounding from microarcsecond longitudes), so agreement
 *   verifies the implementation rather than repeating it.
 * - SELF-CONSISTENCY property checks (continuity, determinism,
 *   half-open lookup semantics) compare the engine against itself and
 *   are labeled as such; they guard invariants, not absolute values.
 * - WIRING test (D1 stub → dasha) checks interface plumbing only and is
 *   labeled as such; it is not an independent oracle.
 *
 * Privacy: generic instants and longitudes only. No personal birth
 * details anywhere in this file.
 */
import { describe, expect, it } from "vitest";
import {
  VIMSHOTTARI_CYCLE_MILLIS,
  VIMSHOTTARI_CYCLE_YEARS,
  VIMSHOTTARI_LORDS,
  VIMSHOTTARI_LORD_YEARS,
  VIMSHOTTARI_YEAR_MILLIS,
  computeVimshottariDasha,
  findActiveDashaPeriod,
  type VimshottariLord,
  type VimshottariTimeline,
} from "../../packages/astrology-core/src/vimshottari";
import {
  FULL_CIRCLE_MICROARCSECONDS,
  NAKSHATRA_WIDTH_MICROARCSECONDS,
} from "../../packages/astrology-core/src/constants";
import { V1_CONFIGURATION } from "../../packages/astrology-core/src/configuration";

/** Hand-checked: 365.25 days in milliseconds. */
const YEAR_MILLIS = 31_557_600_000;
/** Hand-checked: 13°20′ = (360/27)° in microarcseconds. */
const NAKSHATRA_WIDTH = 48_000_000_000;

/** Fixed generic birth instant used across tests (2001-09-09T01:46:40Z). */
const BIRTH_MILLIS = 1_000_000_000_000;

function dashaAt(
  moonLongitudeMicroarcseconds: number,
  birthUtcMillis: number = BIRTH_MILLIS,
): VimshottariTimeline {
  return computeVimshottariDasha(
    { moonLongitudeMicroarcseconds, birthUtcMillis },
    V1_CONFIGURATION,
    { calculatedAt: "2026-10-20T00:00:00.000Z" },
  );
}

describe("vimshottari sequence table (independent reference)", () => {
  it("uses the ADR-005 lord order and durations summing to 120 years", () => {
    const expected: readonly (readonly [VimshottariLord, number])[] = [
      ["ketu", 7],
      ["venus", 20],
      ["sun", 6],
      ["moon", 10],
      ["mars", 7],
      ["rahu", 18],
      ["jupiter", 16],
      ["saturn", 19],
      ["mercury", 17],
    ];
    expect(VIMSHOTTARI_LORDS.length).toBe(9);
    expect(VIMSHOTTARI_LORD_YEARS.length).toBe(9);
    for (let i = 0; i < expected.length; i++) {
      expect(VIMSHOTTARI_LORDS[i]).toBe(expected[i]![0]);
      expect(VIMSHOTTARI_LORD_YEARS[i]).toBe(expected[i]![1]);
    }
    expect(
      VIMSHOTTARI_LORD_YEARS.reduce((sum, years) => sum + years, 0),
    ).toBe(120);
    expect(VIMSHOTTARI_CYCLE_YEARS).toBe(120);
    expect(VIMSHOTTARI_YEAR_MILLIS).toBe(YEAR_MILLIS);
    expect(VIMSHOTTARI_CYCLE_MILLIS).toBe(3_786_912_000_000);
    expect(NAKSHATRA_WIDTH_MICROARCSECONDS).toBe(NAKSHATRA_WIDTH);
  });
});

describe("vimshottari nakshatra mapping (independent reference)", () => {
  it("starts every starting lord from the nine first nakshatras", () => {
    const lords: readonly VimshottariLord[] = [
      "ketu",
      "venus",
      "sun",
      "moon",
      "mars",
      "rahu",
      "jupiter",
      "saturn",
      "mercury",
    ];
    for (let nakshatra = 0; nakshatra < 9; nakshatra++) {
      const timeline = dashaAt(nakshatra * NAKSHATRA_WIDTH);
      expect(timeline.moonNakshatraIndex).toBe(nakshatra);
      expect(timeline.birthMahadashaLord).toBe(lords[nakshatra]);
      const expectedDuration =
        VIMSHOTTARI_LORD_YEARS[nakshatra]! * YEAR_MILLIS;
      expect(timeline.birthMahadashaElapsedMillis).toBe(0);
      expect(timeline.birthMahadashaRemainingMillis).toBe(expectedDuration);
      expect(timeline.notionalMahadashaStartUtcMillis).toBe(BIRTH_MILLIS);
      expect(timeline.mahadashas[0]!.lord).toBe(lords[nakshatra]);
      expect(
        timeline.mahadashas[0]!.endUtcMillis -
          timeline.mahadashas[0]!.startUtcMillis,
      ).toBe(expectedDuration);
    }
  });

  it("maps all 27 nakshatras cyclically with Magha restarting at Ketu", () => {
    for (let nakshatra = 0; nakshatra < 27; nakshatra++) {
      // Interior longitude (plus a small offset) keeps the test inside
      // the intended nakshatra without touching a boundary.
      const timeline = dashaAt(nakshatra * NAKSHATRA_WIDTH + 123_456_789);
      expect(timeline.moonNakshatraIndex).toBe(nakshatra);
      expect(timeline.birthMahadashaLord).toBe(
        VIMSHOTTARI_LORDS[nakshatra % 9],
      );
    }
    expect(dashaAt(9 * NAKSHATRA_WIDTH).birthMahadashaLord).toBe("ketu");
  });

  it("treats exact boundaries as left-inclusive, including wraparound", () => {
    for (const k of [1, 9, 13, 26]) {
      const boundary = k * NAKSHATRA_WIDTH;
      expect(dashaAt(boundary - 1).moonNakshatraIndex).toBe(k - 1);
      expect(dashaAt(boundary).moonNakshatraIndex).toBe(k);
      expect(dashaAt(boundary + 1).moonNakshatraIndex).toBe(k);
    }
    // Circle wraparound: last microarcsecond is Revati, zero is Ashwini.
    expect(dashaAt(FULL_CIRCLE_MICROARCSECONDS - 1).moonNakshatraIndex).toBe(
      26,
    );
    expect(
      dashaAt(FULL_CIRCLE_MICROARCSECONDS - 1).birthMahadashaLord,
    ).toBe("mercury");
    expect(dashaAt(0).moonNakshatraIndex).toBe(0);
    expect(dashaAt(0).birthMahadashaLord).toBe("ketu");
  });
});

describe("vimshottari birth balance (independent reference)", () => {
  it("halves a Ketu Mahadasha at mid-Ashwini", () => {
    // Hand arithmetic: traversed 24,000,000,000 of 48,000,000,000
    // (f = 1/2), Y = 7: elapsed = remaining = 3.5 × 31,557,600,000
    // = 110,451,600,000 ms exactly.
    const timeline = dashaAt(24_000_000_000);
    expect(timeline.moonNakshatraIndex).toBe(0);
    expect(timeline.birthMahadashaLord).toBe("ketu");
    expect(timeline.birthMahadashaElapsedMillis).toBe(110_451_600_000);
    expect(timeline.birthMahadashaRemainingMillis).toBe(110_451_600_000);
    expect(timeline.notionalMahadashaStartUtcMillis).toBe(
      BIRTH_MILLIS - 110_451_600_000,
    );
    // ADR-005 §C equality holds exactly (integer arithmetic, no tolerance).
    expect(
      timeline.mahadashas[0]!.endUtcMillis -
        timeline.mahadashas[0]!.startUtcMillis,
    ).toBe(220_903_200_000);
    expect(timeline.mahadashas[0]!.endUtcMillis).toBe(
      BIRTH_MILLIS + 110_451_600_000,
    );
  });

  it("keeps a 5 ms remainder at the end of Ashwini without restarting", () => {
    // Hand arithmetic: traversed 47,999,999,999 of 48,000,000,000;
    // elapsed = round(220,903,200,000 − 4.6026…) = 220,903,199,995 ms,
    // so remaining = 5 ms exactly and the notional start predates birth.
    const timeline = dashaAt(NAKSHATRA_WIDTH - 1);
    expect(timeline.birthMahadashaElapsedMillis).toBe(220_903_199_995);
    expect(timeline.birthMahadashaRemainingMillis).toBe(5);
    expect(timeline.notionalMahadashaStartUtcMillis).toBe(
      BIRTH_MILLIS - 220_903_199_995,
    );
    expect(timeline.mahadashas[0]!.endUtcMillis).toBe(BIRTH_MILLIS + 5);
    // The Mahadasha is not restarted at birth: it started years earlier.
    expect(timeline.mahadashas[0]!.startUtcMillis).toBeLessThan(BIRTH_MILLIS);
    // Birth is still inside the birth Mahadasha (half-open end).
    expect(timeline.activeAtBirth.mahadashaIndex).toBe(0);
    expect(timeline.activeAtBirth.mahadashaLord).toBe("ketu");
  });
});

describe("vimshottari Mahadasha order and 120-year cycle (mixed)", () => {
  it("runs nine contiguous Mahadashas totaling exactly 120 years from Ashwini start", () => {
    const timeline = dashaAt(0);
    const expectedLords: readonly VimshottariLord[] = [
      "ketu",
      "venus",
      "sun",
      "moon",
      "mars",
      "rahu",
      "jupiter",
      "saturn",
      "mercury",
    ];
    // Independent durations: lord years × 31,557,600,000 ms.
    const expectedDurations = [
      220_903_200_000, 631_152_000_000, 189_345_600_000, 315_576_000_000,
      220_903_200_000, 568_036_800_000, 504_921_600_000, 599_594_400_000,
      536_479_200_000,
    ];
    expect(timeline.mahadashas.length).toBe(9);
    let start = BIRTH_MILLIS;
    for (let i = 0; i < 9; i++) {
      const md = timeline.mahadashas[i]!;
      expect(md.lord).toBe(expectedLords[i]);
      expect(md.startUtcMillis).toBe(start);
      expect(md.endUtcMillis - md.startUtcMillis).toBe(expectedDurations[i]);
      // Self-consistency: exact contiguity between consecutive periods.
      if (i > 0) {
        expect(md.startUtcMillis).toBe(
          timeline.mahadashas[i - 1]!.endUtcMillis,
        );
      }
      expect(md.startUtcInstant).toBe(new Date(start).toISOString());
      start += expectedDurations[i]!;
    }
    expect(start - BIRTH_MILLIS).toBe(3_786_912_000_000);
    expect(timeline.mahadashas[8]!.endUtcMillis - BIRTH_MILLIS).toBe(
      VIMSHOTTARI_CYCLE_MILLIS,
    );
  });
});

describe("vimshottari Antardashas (independent reference)", () => {
  // Hand arithmetic for a full 20-year Venus Mahadasha from Bharani
  // start. Antardashas begin with the Mahadasha lord (Venus) and run
  // AD duration = 20 × lordYears ÷ 120 years, i.e. lordYears ×
  // 5,259,600,000 ms. Cumulative offsets from the Mahadasha start:
  // 0 / 105,192,000,000 / 136,749,600,000 / 189,345,600,000 /
  // 226,162,800,000 / 320,835,600,000 / 404,989,200,000 /
  // 504,921,600,000 / 594,334,800,000, ending at 631,152,000,000.
  const venusAdOffsets = [
    0, 105_192_000_000, 136_749_600_000, 189_345_600_000,
    226_162_800_000, 320_835_600_000, 404_989_200_000,
    504_921_600_000, 594_334_800_000,
  ];
  const venusAdLords: readonly VimshottariLord[] = [
    "venus",
    "sun",
    "moon",
    "mars",
    "rahu",
    "jupiter",
    "saturn",
    "mercury",
    "ketu",
  ];

  it("orders Antardashas from the Mahadasha lord with proportional durations", () => {
    const timeline = dashaAt(NAKSHATRA_WIDTH);
    expect(timeline.birthMahadashaLord).toBe("venus");
    const md = timeline.mahadashas[0]!;
    expect(md.antardashas.length).toBe(9);
    for (let k = 0; k < 9; k++) {
      const ad = md.antardashas[k]!;
      expect(ad.lord).toBe(venusAdLords[k]);
      expect(ad.startUtcMillis - md.startUtcMillis).toBe(venusAdOffsets[k]);
    }
    // The last Antardasha ends exactly at the Mahadasha boundary.
    const last = md.antardashas[8]!;
    expect(last.endUtcMillis).toBe(md.endUtcMillis);
    expect(last.endUtcMillis - last.startUtcMillis).toBe(36_817_200_000);
    expect(md.endUtcMillis - md.startUtcMillis).toBe(631_152_000_000);
  });

  it("finds the birth-active Antardasha inside a partially elapsed Mahadasha", () => {
    // Hand arithmetic: Bharani + 8,400,000,000 µas traversed
    // (f = 0.175), Y = 20: elapsed = 3.5 × 31,557,600,000
    // = 110,451,600,000 ms, inside Sun-AD
    // [105,192,000,000, 136,749,600,000), so the Venus Antardasha
    // (ending at 105,192,000,000) lies entirely before birth.
    const timeline = dashaAt(NAKSHATRA_WIDTH + 8_400_000_000);
    expect(timeline.birthMahadashaElapsedMillis).toBe(110_451_600_000);
    expect(timeline.birthMahadashaRemainingMillis).toBe(
      631_152_000_000 - 110_451_600_000,
    );
    expect(timeline.activeAtBirth).toEqual({
      mahadashaIndex: 0,
      mahadashaLord: "venus",
      antardashaIndex: 1,
      antardashaLord: "sun",
    });
    const md = timeline.mahadashas[0]!;
    expect(md.antardashas[0]!.endUtcMillis).toBeLessThan(BIRTH_MILLIS);
    expect(md.antardashas[1]!.startUtcMillis).toBeLessThanOrEqual(
      BIRTH_MILLIS,
    );
    expect(md.antardashas[1]!.endUtcMillis).toBeGreaterThan(BIRTH_MILLIS);
  });
});

describe("vimshottari boundaries and lookup (self-consistency)", () => {
  it("applies half-open semantics immediately around a Mahadasha transition", () => {
    const timeline = dashaAt(NAKSHATRA_WIDTH - 1);
    const mdEnd = timeline.mahadashas[0]!.endUtcMillis;
    expect(findActiveDashaPeriod(timeline.mahadashas, mdEnd - 1)).toEqual({
      mahadashaIndex: 0,
      mahadashaLord: "ketu",
      antardashaIndex: 8,
      antardashaLord: "mercury",
    });
    expect(findActiveDashaPeriod(timeline.mahadashas, mdEnd)).toEqual({
      mahadashaIndex: 1,
      mahadashaLord: "venus",
      antardashaIndex: 0,
      antardashaLord: "venus",
    });
    expect(findActiveDashaPeriod(timeline.mahadashas, mdEnd + 1)).toEqual({
      mahadashaIndex: 1,
      mahadashaLord: "venus",
      antardashaIndex: 0,
      antardashaLord: "venus",
    });
  });

  it("returns null outside the computed 120-year cycle", () => {
    const timeline = dashaAt(0);
    const cycleStart = timeline.mahadashas[0]!.startUtcMillis;
    const cycleEnd = timeline.mahadashas[8]!.endUtcMillis;
    expect(findActiveDashaPeriod(timeline.mahadashas, cycleStart - 1)).toBe(
      null,
    );
    expect(findActiveDashaPeriod(timeline.mahadashas, cycleEnd)).toBe(null);
    expect(findActiveDashaPeriod(timeline.mahadashas, cycleEnd + 1)).toBe(
      null,
    );
    expect(
      findActiveDashaPeriod(timeline.mahadashas, cycleStart),
    ).not.toBe(null);
  });

  it("is deterministic for identical inputs", () => {
    const options = { calculatedAt: "2026-10-20T00:00:00.000Z" };
    const first = computeVimshottariDasha(
      { moonLongitudeMicroarcseconds: 56_400_000_000, birthUtcMillis: BIRTH_MILLIS },
      V1_CONFIGURATION,
      options,
    );
    const second = computeVimshottariDasha(
      { moonLongitudeMicroarcseconds: 56_400_000_000, birthUtcMillis: BIRTH_MILLIS },
      V1_CONFIGURATION,
      options,
    );
    expect(second).toEqual(first);
  });
});

describe("vimshottari leap years and year transitions (independent reference)", () => {
  it("lands a 7-year span from a leap day on the hand-computed instant", () => {
    // Birth 2000-02-29T00:00:00Z (951,782,400,000 ms) at Ashwini start:
    // Ketu end = birth + 220,903,200,000 ms = 1,172,685,600,000 ms,
    // i.e. 2007-02-28T18:00:00.000Z (verified by desk calculation;
    // a 365.25-day year calendar does not follow civil leap rules).
    const timeline = dashaAt(0, 951_782_400_000);
    expect(timeline.birthUtcInstant).toBe("2000-02-29T00:00:00.000Z");
    expect(timeline.mahadashas[0]!.endUtcMillis).toBe(1_172_685_600_000);
    expect(timeline.mahadashas[0]!.endUtcInstant).toBe(
      "2007-02-28T18:00:00.000Z",
    );
  });

  it("crosses a year boundary with exact millisecond continuity", () => {
    // 1999-12-31T23:59:59.999Z with 5 ms of Ketu Mahadasha remaining:
    // the Venus Mahadasha starts exactly at 2000-01-01T00:00:00.004Z.
    const birth = Date.UTC(1999, 11, 31, 23, 59, 59, 999);
    const timeline = dashaAt(NAKSHATRA_WIDTH - 1, birth);
    expect(timeline.birthUtcInstant).toBe("1999-12-31T23:59:59.999Z");
    expect(timeline.mahadashas[0]!.endUtcInstant).toBe(
      "2000-01-01T00:00:00.004Z",
    );
    expect(timeline.mahadashas[1]!.startUtcInstant).toBe(
      "2000-01-01T00:00:00.004Z",
    );
    expect(timeline.mahadashas[1]!.lord).toBe("venus");
  });
});

describe("vimshottari D1 wiring (same-code-path check, not independent)", () => {
  it("derives the dasha start from the D1 engine Moon longitude", async () => {
    const { computeD1Chart } = await import(
      "../../packages/astrology-core/src/d1-chart"
    );
    const moonLongitude = NAKSHATRA_WIDTH + 8_400_000_000;
    const stub = {
      id: "stub-provider",
      dataVersion: "stub-1",
      positionAt: async (utcInstant: string, body: string) => ({
        longitudeMicroarcseconds:
          body === "moon" ? moonLongitude : 100 * 3_600_000_000,
        providerBodyId: `stub:${body}`,
      }),
    };
    const chart = await computeD1Chart(
      {
        localDateTime: "2001-09-09T07:16:40",
        timeZone: "Asia/Kolkata",
        latitude: 17.385,
        longitude: 78.4867,
        timePrecision: "exact",
      },
      stub,
      V1_CONFIGURATION,
      { calculatedAt: "2026-10-20T00:00:00.000Z" },
    );
    expect(chart.placements["moon"].nakshatraIndex).toBe(1);
    const timeline = computeVimshottariDasha(
      {
        moonLongitudeMicroarcseconds:
          chart.placements["moon"].longitudeMicroarcseconds,
        birthUtcMillis: Date.parse(chart.utcInstant),
      },
      chart.configuration,
    );
    expect(timeline.moonNakshatraIndex).toBe(1);
    expect(timeline.birthMahadashaLord).toBe("venus");
    expect(timeline.birthMahadashaElapsedMillis).toBe(110_451_600_000);
    expect(timeline.activeAtBirth.antardashaLord).toBe("sun");
  });
});

describe("vimshottari invalid inputs (self-consistency)", () => {
  it("rejects bad longitudes, birth instants, and configurations", () => {
    const valid = {
      moonLongitudeMicroarcseconds: 56_400_000_000,
      birthUtcMillis: BIRTH_MILLIS,
    };
    for (const badLongitude of [
      -1,
      FULL_CIRCLE_MICROARCSECONDS,
      3.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() =>
        computeVimshottariDasha(
          { ...valid, moonLongitudeMicroarcseconds: badLongitude },
          V1_CONFIGURATION,
        ),
      ).toThrow("Moon longitude");
    }
    for (const badBirth of [
      Number.NaN,
      1.5,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() =>
        computeVimshottariDasha(
          { ...valid, birthUtcMillis: badBirth },
          V1_CONFIGURATION,
        ),
      ).toThrow("birth instant");
    }
    // Safe integer but outside the representable timestamp range
    // (beyond ±8,640,000,000,000,000 ms): boundaries stay safe but no
    // instant in the cycle is serializable.
    expect(() =>
      computeVimshottariDasha(
        { ...valid, birthUtcMillis: 8_900_000_000_000_000 },
        V1_CONFIGURATION,
      ),
    ).toThrow("representable timestamp range");
    expect(() =>
      computeVimshottariDasha(valid, {
        ...V1_CONFIGURATION,
        dashaYearDays: 365 as never,
      }),
    ).toThrow("only the V1 configuration");
    expect(() =>
      computeVimshottariDasha(valid, {
        ...V1_CONFIGURATION,
        ayanamsha: "raman" as never,
      }),
    ).toThrow("only the V1 configuration");
    expect(findActiveDashaPeriod(dashaAt(0).mahadashas, Number.NaN)).toBe(
      null,
    );
  });
});
