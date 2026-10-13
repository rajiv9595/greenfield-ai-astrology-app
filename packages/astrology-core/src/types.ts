export type Ayanamsha = "lahiri";
export type HouseSystem = "whole-sign";
export type NodeConvention = "mean";
export type Zodiac = "sidereal";

export interface CalculationConfiguration {
  readonly zodiac: Zodiac;
  readonly ayanamsha: Ayanamsha;
  readonly houseSystem: HouseSystem;
  readonly nodeConvention: NodeConvention;
  readonly dashaYearDays: 365.25;
  readonly ruleSetVersion: string;
}

export interface BirthInput {
  /** ISO local civil date-time without an offset, for example 1990-04-21T14:30:00. */
  readonly localDateTime: string;
  /** A named IANA zone such as Asia/Kolkata; abbreviations are not accepted. */
  readonly timeZone: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timePrecision: "exact" | "approximate" | "unknown";
}

export interface CalculationProvenance {
  readonly engineVersion: string;
  readonly ephemerisProvider: string;
  readonly ephemerisDataVersion: string;
  readonly timeZoneDataVersion: string;
  readonly calculatedAt: string;
}

export interface EphemerisPosition {
  /** Sidereal ecliptic longitude, normalized to [0°, 360°), in microarcseconds. */
  readonly longitudeMicroarcseconds: number;
  readonly providerBodyId: string;
}

export interface EphemerisProvider {
  readonly id: string;
  readonly dataVersion: string;
  positionAt(utcInstant: string, body: string, configuration: CalculationConfiguration): Promise<EphemerisPosition>;
}
