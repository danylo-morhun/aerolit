import { describe, expect, it } from 'vitest';

import { buildSeries, SNAPSHOT_NOW, SNAPSHOT_START } from '../../tests/factories';
import {
  deriveStationMetrics,
  indexAtOrBefore,
  readingAtOrBefore,
  sparklineValues,
  SPARKLINE_HOURS,
} from './station-metrics';
import { STABILITY_WINDOW_HOURS } from './stability';
import { HOUR_MS } from './time';

const base = { stationId: 'BLN-0001', at: SNAPSHOT_NOW, dataStart: SNAPSHOT_START };

describe('indexAtOrBefore', () => {
  const series = buildSeries({ hours: 5 });

  it('finds the exact hour', () => {
    expect(indexAtOrBefore(series, series[3]!.t)).toBe(3);
  });

  it('falls back to the previous reading between hours', () => {
    expect(indexAtOrBefore(series, series[3]!.t + 59 * 60_000)).toBe(3);
  });

  it('returns -1 before the series starts, and the last index after it ends', () => {
    expect(indexAtOrBefore(series, series[0]!.t - HOUR_MS)).toBe(-1);
    expect(indexAtOrBefore(series, series[4]!.t + 10 * HOUR_MS)).toBe(4);
    expect(indexAtOrBefore([], SNAPSHOT_NOW)).toBe(-1);
  });
});

describe('readingAtOrBefore', () => {
  it('returns null when nothing precedes the instant', () => {
    expect(readingAtOrBefore(buildSeries({ hours: 2 }), SNAPSHOT_START)).toBeNull();
  });
});

describe('sparklineValues', () => {
  it('returns the trailing 24 hours, oldest first', () => {
    const series = buildSeries({ hours: 48, pm25: (slot) => slot });
    const values = sparklineValues(series, SNAPSHOT_NOW);
    expect(values).toHaveLength(SPARKLINE_HOURS);
    expect(values.at(0)).toBe(24);
    expect(values.at(-1)).toBe(47);
  });

  it('omits missing hours instead of zero-filling them', () => {
    // A zero would draw the line to the floor and read as clean air.
    const series = buildSeries({ hours: 48, missing: [40, 41], pm25: () => 30 });
    const values = sparklineValues(series, SNAPSHOT_NOW);
    expect(values).toHaveLength(SPARKLINE_HOURS - 2);
    expect(values).not.toContain(0);
  });

  it('is empty for a station with no readings', () => {
    expect(sparklineValues([], SNAPSHOT_NOW)).toEqual([]);
  });
});

describe('deriveStationMetrics', () => {
  it('reports the latest reading and its category', () => {
    const series = buildSeries({
      hours: STABILITY_WINDOW_HOURS,
      pm25: (slot) => (slot === STABILITY_WINDOW_HOURS - 1 ? 53 : 20),
      pm10: (slot) => (slot === STABILITY_WINDOW_HOURS - 1 ? 97 : 40),
    });

    const metrics = deriveStationMetrics({ ...base, series });

    expect(metrics).toMatchObject({
      stationId: 'BLN-0001',
      pm25: 53,
      pm10: 97,
      aqi: 'elevated',
      stability: 1,
      connection: 'hq',
    });
  });

  it('keeps the last known reading for an offline station', () => {
    // The mockup shows concentrations for offline sensors; `connection` is
    // what communicates the silence, not a blanked-out value.
    const series = buildSeries({
      endingAt: SNAPSHOT_NOW - 3 * HOUR_MS,
      hours: 100,
      pm25: () => 17,
    });
    const metrics = deriveStationMetrics({ ...base, series });

    expect(metrics.connection).toBe('offline');
    expect(metrics.pm25).toBe(17);
    expect(metrics.aqi).toBe('moderate');
  });

  it('degrades to nulls for an empty series', () => {
    const metrics = deriveStationMetrics({ ...base, series: [] });
    expect(metrics).toMatchObject({
      pm25: null,
      pm10: null,
      aqi: null,
      stability: 0,
      connection: 'offline',
    });
    expect(metrics.sparkline).toEqual([]);
  });

  it('evaluates a past instant as if it were now', () => {
    // The KPI trend badges rely on this: the week-ago reference comes from the
    // same function, so the two figures cannot drift apart.
    const weekEarlier = SNAPSHOT_NOW - 168 * HOUR_MS;
    const series = buildSeries({
      hours: STABILITY_WINDOW_HOURS,
      pm25: (slot) => (slot === STABILITY_WINDOW_HOURS - 1 - 168 ? 42 : 10),
    });

    expect(deriveStationMetrics({ ...base, series, at: weekEarlier }).pm25).toBe(42);
    expect(deriveStationMetrics({ ...base, series }).pm25).toBe(10);
  });
});
