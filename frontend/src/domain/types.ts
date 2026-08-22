/**
 * Domain models.
 *
 * These live in `domain/` rather than `api/` on purpose: they are what the
 * application reasons about, and the API layer's job is to produce them. The
 * dependency runs api → domain, never the other way, so a change to the wire
 * format is absorbed in one place.
 */

export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

/** A station's static identity — everything the API knows without readings. */
export interface Station {
  readonly id: string;
  readonly district: string;
  readonly location: string;
  readonly coordinates: Coordinates;
}

/** One hourly measurement, in µg/m³. */
export interface Reading {
  /** Epoch milliseconds, normalised on ingest from the API's ISO string. */
  readonly t: number;
  readonly pm25: number;
  readonly pm10: number;
}

/** Ascending by `t`, one entry per hour the station actually reported. */
export type ReadingSeries = readonly Reading[];

export type Pollutant = 'pm25' | 'pm10';

export type AqiCategory = 'good' | 'moderate' | 'elevated' | 'unhealthy';

export type ConnectionState = 'offline' | 'poor' | 'hq';

export type ChartRange = '24h' | '7d' | '30d';

/** Everything the UI shows about one station, derived from its series. */
export interface StationMetrics {
  readonly stationId: string;
  /** Latest reading in the window, or `null` when the series is empty. */
  readonly pm25: number | null;
  readonly pm10: number | null;
  readonly aqi: AqiCategory | null;
  /** Share of expected hours actually reported, 0–1. */
  readonly stability: number;
  readonly connection: ConnectionState;
  /** Trailing 24 h of PM2.5, oldest first, for the sparkline. */
  readonly sparkline: readonly number[];
}
