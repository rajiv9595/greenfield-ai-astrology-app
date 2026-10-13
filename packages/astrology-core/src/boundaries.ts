import {
  FULL_CIRCLE_MICROARCSECONDS,
  NAKSHATRA_WIDTH_MICROARCSECONDS,
  PADA_WIDTH_MICROARCSECONDS,
  SIGN_WIDTH_MICROARCSECONDS,
} from "./constants";

/** Normalizes an angular value to the half-open interval [0°, 360°). */
export function normalizeLongitude(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error("longitude must be a safe integer in microarcseconds");
  return ((value % FULL_CIRCLE_MICROARCSECONDS) + FULL_CIRCLE_MICROARCSECONDS) % FULL_CIRCLE_MICROARCSECONDS;
}

/** Returns the zero-based container index for a left-inclusive, right-exclusive partition. */
export function partitionIndex(longitude: number, width: number, partitions: number): number {
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(partitions) || partitions <= 0) {
    throw new Error("partition dimensions must be positive safe integers");
  }
  const normalized = normalizeLongitude(longitude);
  const index = Math.floor(normalized / width);
  if (index < 0 || index >= partitions) throw new Error("partition does not cover the circle");
  return index;
}

export function signIndex(longitude: number): number {
  return partitionIndex(longitude, SIGN_WIDTH_MICROARCSECONDS, 12);
}

export function nakshatraIndex(longitude: number): number {
  return partitionIndex(longitude, NAKSHATRA_WIDTH_MICROARCSECONDS, 27);
}

export function padaIndex(longitude: number): number {
  return partitionIndex(longitude, PADA_WIDTH_MICROARCSECONDS, 108);
}
