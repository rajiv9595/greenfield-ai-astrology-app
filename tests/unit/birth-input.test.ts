import { describe, expect, it } from "vitest";
import { validateBirthInput } from "../../packages/astrology-core/src";

describe("birth-input validation", () => {
  const valid = {
    localDateTime: "1990-04-21T14:30:00",
    timeZone: "Asia/Kolkata",
    latitude: 17.385,
    longitude: 78.4867,
    timePrecision: "exact" as const,
  };

  it("accepts precise named-zone inputs", () => {
    expect(() => validateBirthInput(valid)).not.toThrow();
  });

  it("rejects an ambiguous time-zone abbreviation", () => {
    expect(() => validateBirthInput({ ...valid, timeZone: "IST" })).toThrow("named IANA");
  });

  it("rejects invalid coordinates", () => {
    expect(() => validateBirthInput({ ...valid, latitude: 91 })).toThrow("latitude");
  });
});
