import { describe, expect, it } from "vitest";
import {
  FULL_CIRCLE_MICROARCSECONDS,
  NAKSHATRA_WIDTH_MICROARCSECONDS,
  SIGN_WIDTH_MICROARCSECONDS,
  nakshatraIndex,
  normalizeLongitude,
  padaIndex,
  signIndex,
} from "../../packages/astrology-core/src";

describe("angular boundaries", () => {
  it("normalizes the full circle to the first degree", () => {
    expect(normalizeLongitude(FULL_CIRCLE_MICROARCSECONDS)).toBe(0);
    expect(normalizeLongitude(-1)).toBe(FULL_CIRCLE_MICROARCSECONDS - 1);
  });

  it("uses left-inclusive sign boundaries", () => {
    expect(signIndex(SIGN_WIDTH_MICROARCSECONDS - 1)).toBe(0);
    expect(signIndex(SIGN_WIDTH_MICROARCSECONDS)).toBe(1);
  });

  it("uses left-inclusive nakshatra and pada boundaries", () => {
    expect(nakshatraIndex(NAKSHATRA_WIDTH_MICROARCSECONDS - 1)).toBe(0);
    expect(nakshatraIndex(NAKSHATRA_WIDTH_MICROARCSECONDS)).toBe(1);
    expect(padaIndex(0)).toBe(0);
    expect(padaIndex(NAKSHATRA_WIDTH_MICROARCSECONDS)).toBe(4);
  });
});
