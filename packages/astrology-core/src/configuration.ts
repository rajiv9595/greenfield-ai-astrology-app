import type { BirthInput, CalculationConfiguration } from "./types";

export const V1_CONFIGURATION: CalculationConfiguration = Object.freeze({
  zodiac: "sidereal",
  ayanamsha: "lahiri",
  houseSystem: "whole-sign",
  nodeConvention: "mean",
  dashaYearDays: 365.25,
  ruleSetVersion: "v1-draft",
});

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
const IANA_ZONE = /^[A-Za-z_+-]+\/[A-Za-z_+\-/]+$/;

export function validateBirthInput(input: BirthInput): void {
  if (!LOCAL_DATE_TIME.test(input.localDateTime) || Number.isNaN(Date.parse(`${input.localDateTime}Z`))) {
    throw new Error("localDateTime must be a valid ISO local date-time without an offset");
  }
  if (!IANA_ZONE.test(input.timeZone) || !isSupportedTimeZone(input.timeZone)) {
    throw new Error("timeZone must be a supported named IANA time zone");
  }
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error("latitude must be between -90 and 90");
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error("longitude must be between -180 and 180");
  }
}

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}
