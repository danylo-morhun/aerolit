import { describe, expect, it } from 'vitest';

import { type SortableRow, SERVER_ORDERED_KEYS, sortRows } from './sort';
import type { AqiCategory, ConnectionState, Station, StationMetrics } from './types';

function row(
  id: string,
  overrides: Partial<StationMetrics> & Partial<Pick<Station, 'district' | 'location'>> = {},
): SortableRow {
  const { district = 'Mitte', location = 'Alexanderplatz', ...metrics } = overrides;
  return {
    station: { id, district, location, coordinates: { lat: 0, lng: 0 } },
    metrics: {
      stationId: id,
      pm25: 10,
      pm10: 20,
      aqi: 'good' as AqiCategory,
      stability: 1,
      connection: 'hq' as ConnectionState,
      sparkline: [],
      ...metrics,
    },
  };
}

const ids = (rows: readonly SortableRow[]) => rows.map((r) => r.station.id);

describe('sortRows', () => {
  it('orders text columns alphabetically in both directions', () => {
    const rows = [row('BLN-0002', { district: 'Pankow' }), row('BLN-0001', { district: 'Mitte' })];

    expect(ids(sortRows(rows, 'district', 'asc'))).toEqual(['BLN-0001', 'BLN-0002']);
    expect(ids(sortRows(rows, 'district', 'desc'))).toEqual(['BLN-0002', 'BLN-0001']);
  });

  it('orders measurements numerically', () => {
    const rows = [row('a', { pm25: 30 }), row('b', { pm25: 5 }), row('c', { pm25: 17 })];

    expect(ids(sortRows(rows, 'pm25', 'asc'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortRows(rows, 'pm25', 'desc'))).toEqual(['a', 'c', 'b']);
  });

  it('keeps stations with no reading last in both directions', () => {
    // Treating a missing value as 0 would head a "cleanest air" sort with
    // broken sensors — the opposite of what the operator is looking for.
    const rows = [row('a', { pm25: 30 }), row('b', { pm25: null }), row('c', { pm25: 5 })];

    expect(ids(sortRows(rows, 'pm25', 'asc'))).toEqual(['c', 'a', 'b']);
    expect(ids(sortRows(rows, 'pm25', 'desc'))).toEqual(['a', 'c', 'b']);
  });

  it('orders AQI by severity, not alphabetically', () => {
    const rows = [
      row('a', { aqi: 'unhealthy' }),
      row('b', { aqi: 'good' }),
      row('c', { aqi: 'elevated' }),
      row('d', { aqi: 'moderate' }),
    ];

    expect(ids(sortRows(rows, 'aqi', 'asc'))).toEqual(['b', 'd', 'c', 'a']);
  });

  it('orders connection healthiest first when ascending', () => {
    const rows = [
      row('a', { connection: 'offline' }),
      row('b', { connection: 'hq' }),
      row('c', { connection: 'poor' }),
    ];

    expect(ids(sortRows(rows, 'connection', 'asc'))).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties by id so rows never shuffle between renders', () => {
    const rows = [row('BLN-0003'), row('BLN-0001'), row('BLN-0002')];

    expect(ids(sortRows(rows, 'pm25', 'asc'))).toEqual(['BLN-0001', 'BLN-0002', 'BLN-0003']);
    expect(ids(sortRows(rows, 'pm25', 'desc'))).toEqual(['BLN-0001', 'BLN-0002', 'BLN-0003']);
  });

  it('handles rows whose metrics have not loaded yet', () => {
    const rows: SortableRow[] = [
      {
        station: { id: 'b', district: 'X', location: 'Y', coordinates: { lat: 0, lng: 0 } },
        metrics: null,
      },
      row('a', { pm25: 5 }),
    ];

    expect(ids(sortRows(rows, 'pm25', 'asc'))).toEqual(['a', 'b']);
  });

  it('names id as the only ordering the server itself provides', () => {
    expect(SERVER_ORDERED_KEYS).toEqual(['id']);
  });
});
