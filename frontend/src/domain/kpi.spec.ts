import { describe, expect, it } from 'vitest';

import { computeKpis, KPI_DEFINITIONS, kpiDeltas, type KpiSnapshot } from './kpi';
import type { StationMetrics } from './types';

function metrics(overrides: Partial<StationMetrics> = {}): StationMetrics {
  return {
    stationId: 'BLN-0001',
    pm25: 20,
    pm10: 40,
    aqi: 'moderate',
    stability: 1,
    connection: 'hq',
    sparkline: [],
    ...overrides,
  };
}

describe('computeKpis', () => {
  it('counts every station that is not offline as active', () => {
    const result = computeKpis([
      metrics({ connection: 'hq' }),
      metrics({ connection: 'poor' }),
      metrics({ connection: 'offline' }),
    ]);

    expect(result.activeSensors).toBe(2);
    expect(result.poorConnections).toBe(1);
  });

  it('excludes offline stations from the average concentration', () => {
    // Their last reading may be days old; folding it into a "current" average
    // would mix stale air into a live number.
    const result = computeKpis([
      metrics({ pm25: 10 }),
      metrics({ pm25: 20 }),
      metrics({ pm25: 900, connection: 'offline' }),
    ]);

    expect(result.avgPm25).toBe(15);
  });

  it('includes offline stations in network stability', () => {
    // A sensor that stopped reporting is the strongest evidence of an
    // undependable network; excluding it would improve the number as the
    // fleet degrades.
    const result = computeKpis([
      metrics({ stability: 1 }),
      metrics({ stability: 0.5, connection: 'offline' }),
    ]);

    expect(result.networkStability).toBe(0.75);
  });

  it('handles an empty network without dividing by zero', () => {
    expect(computeKpis([])).toEqual({
      activeSensors: 0,
      avgPm25: null,
      poorConnections: 0,
      networkStability: 0,
    });
  });

  it('reports no average when every station is offline', () => {
    expect(computeKpis([metrics({ connection: 'offline' })]).avgPm25).toBeNull();
  });
});

describe('kpiDeltas', () => {
  const current: KpiSnapshot = {
    activeSensors: 33,
    avgPm25: 28.9,
    poorConnections: 16,
    networkStability: 0.868,
  };

  it('subtracts the week-ago reference in each KPI’s own unit', () => {
    const reference: KpiSnapshot = {
      activeSensors: 27,
      avgPm25: 31.3,
      poorConnections: 0,
      networkStability: 0.86,
    };

    const deltas = kpiDeltas(current, reference);

    expect(deltas.activeSensors).toBe(6);
    expect(deltas.avgPm25).toBeCloseTo(-2.4, 10);
    expect(deltas.poorConnections).toBe(16);
    // Percentage points, not percent.
    expect(deltas.networkStability).toBeCloseTo(0.8, 10);
  });

  it('returns nulls when there is no reference to compare against', () => {
    expect(kpiDeltas(current, null)).toEqual({
      activeSensors: null,
      avgPm25: null,
      poorConnections: null,
      networkStability: null,
    });
  });

  it('returns null for the average when either side has no reading', () => {
    const reference: KpiSnapshot = { ...current, avgPm25: null };
    expect(kpiDeltas(current, reference).avgPm25).toBeNull();
  });
});

describe('KPI_DEFINITIONS', () => {
  it('encodes which direction is an improvement', () => {
    const polarity = Object.fromEntries(KPI_DEFINITIONS.map((k) => [k.id, k.higherIsBetter]));
    expect(polarity).toEqual({
      activeSensors: true,
      avgPm25: false,
      poorConnections: false,
      networkStability: true,
    });
  });
});
