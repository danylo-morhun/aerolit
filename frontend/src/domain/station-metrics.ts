import { classify } from './aqi';
import { connectionAt, stabilityAt, STABILITY_WINDOW_HOURS } from './stability';
import { RANGE_HOURS, windowStart } from './time';
import type { Reading, ReadingSeries, StationMetrics } from './types';

export const SPARKLINE_HOURS = RANGE_HOURS['24h'];

/** Index of the last reading at or before `at`, or -1 if there is none. */
export function indexAtOrBefore(series: ReadingSeries, at: number): number {
  let low = 0;
  let high = series.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const t = series[mid]?.t;
    if (t === undefined) break;
    if (t <= at) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** The most recent reading at or before `at`, or `null`. */
export function readingAtOrBefore(series: ReadingSeries, at: number): Reading | null {
  const index = indexAtOrBefore(series, at);
  return index === -1 ? null : (series[index] ?? null);
}

export interface DeriveMetricsInput {
  readonly stationId: string;
  readonly series: ReadingSeries;
  /** The instant to evaluate at — the snapshot's latest hour for live values. */
  readonly at: number;
  readonly dataStart: number;
  readonly windowHours?: number;
}

/**
 * Everything the UI shows for one station, from one pass over its series.
 *
 * Deliberately takes `at` rather than assuming "latest": the KPI trend badges
 * re-run exactly this function anchored at now − 168 h, so the live figure and
 * the week-ago reference are produced by the same code and cannot drift apart.
 *
 * An offline station keeps its last known concentrations — that is what the
 * reference mockup shows, and an operator looking at a silent sensor still
 * wants its final reading. `connection` is what communicates the silence.
 */
export function deriveStationMetrics({
  stationId,
  series,
  at,
  dataStart,
  windowHours = STABILITY_WINDOW_HOURS,
}: DeriveMetricsInput): StationMetrics {
  const latest = readingAtOrBefore(series, at);
  const stabilityInput = { series, now: at, dataStart, windowHours };

  return {
    stationId,
    pm25: latest?.pm25 ?? null,
    pm10: latest?.pm10 ?? null,
    aqi: classify(latest?.pm25 ?? null),
    stability: stabilityAt(stabilityInput),
    connection: connectionAt(stabilityInput),
    sparkline: sparklineValues(series, at),
  };
}

/**
 * Trailing 24 h of PM2.5, oldest first.
 *
 * Missing hours are omitted rather than zero-filled: a zero would draw the
 * sparkline down to the floor and read as clean air, when what actually
 * happened is that nothing was reported.
 */
export function sparklineValues(series: ReadingSeries, at: number): readonly number[] {
  const from = windowStart(at, SPARKLINE_HOURS);
  const values: number[] = [];
  for (let i = indexAtOrBefore(series, at); i >= 0; i -= 1) {
    const reading = series[i];
    if (reading === undefined || reading.t < from) break;
    values.push(reading.pm25);
  }
  return values.reverse();
}
