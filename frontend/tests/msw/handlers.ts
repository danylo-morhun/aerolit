import { http, HttpResponse } from 'msw';

import type { ReadingDto, StationDto } from '@/api/types';
import { HOUR_MS } from '@/domain/time';

export const TEST_NOW = Date.parse('2026-07-11T12:00:00Z');
/** Small enough to keep tests fast, long enough to exercise the 30-day window. */
export const TEST_WINDOW_HOURS = 720;
export const TEST_START = TEST_NOW - (TEST_WINDOW_HOURS - 1) * HOUR_MS;

export interface FixtureStation extends StationDto {
  /** Slot offsets to drop, simulating missed submissions. */
  missing?: number[];
  pm25?: number;
  pm10?: number;
}

/**
 * A miniature network: one healthy station, one with a poor link, one silent.
 *
 * Three stations rather than a copy of the real 240 — the integration tests are
 * about wiring (does the page fetch, derive, render and paginate?), and the
 * numbers themselves are already pinned against the real dataset in
 * `tests/dataset.spec.ts`.
 */
export const FIXTURE_STATIONS: FixtureStation[] = [
  {
    id: 'BLN-0001',
    district: 'Mitte',
    location: 'Alexanderplatz',
    coordinates: { lat: 52.5295, lng: 13.41614 },
    pm25: 53,
    pm10: 97,
  },
  {
    id: 'BLN-0002',
    district: 'Pankow',
    location: 'Schoenhauser Allee',
    coordinates: { lat: 52.5487, lng: 13.4142 },
    pm25: 8,
    pm10: 15,
    // ~21% of hours dropped: reporting, but below the 86% HQ threshold.
    missing: Array.from({ length: 150 }, (_, i) => i),
  },
  {
    id: 'BLN-0003',
    district: 'Neukoelln',
    location: 'Hermannplatz',
    coordinates: { lat: 52.4869, lng: 13.4247 },
    pm25: 22,
    pm10: 40,
    // Missing the most recent hour: offline whatever its stability.
    missing: [TEST_WINDOW_HOURS - 1],
  },
];

function seriesFor(station: FixtureStation): ReadingDto[] {
  const skip = new Set(station.missing ?? []);
  const readings: ReadingDto[] = [];

  for (let slot = 0; slot < TEST_WINDOW_HOURS; slot += 1) {
    if (skip.has(slot)) continue;
    readings.push({
      t: new Date(TEST_START + slot * HOUR_MS).toISOString(),
      pm25: station.pm25 ?? 20,
      pm10: station.pm10 ?? 40,
    });
  }
  return readings;
}

const encode = (id: string) => btoa(id).replace(/=+$/, '');
const decode = (cursor: string) => atob(cursor);

/**
 * Mirrors the mock API's cursor semantics, including omitting a cursor when
 * there is no page in that direction — the behaviour the pagination controls
 * key their disabled state off.
 */
export const handlers = [
  http.get('/api/stations/count', () => HttpResponse.json({ total: FIXTURE_STATIONS.length })),

  http.get('/api/stations', ({ request }) => {
    const url = new URL(request.url, 'http://localhost');
    const limit = Number(url.searchParams.get('limit')) || 20;
    const after = url.searchParams.get('after');
    const before = url.searchParams.get('before');

    let start = 0;
    let end: number;
    if (before) {
      end = FIXTURE_STATIONS.findIndex((s) => s.id === decode(before));
      start = Math.max(0, end - limit);
    } else {
      if (after) start = FIXTURE_STATIONS.findIndex((s) => s.id === decode(after)) + 1;
      end = Math.min(FIXTURE_STATIONS.length, start + limit);
    }

    const items = FIXTURE_STATIONS.slice(start, end).map(
      ({ id, district, location, coordinates }) => ({ id, district, location, coordinates }),
    );

    const pageInfo: { after?: string; before?: string } = {};
    if (items.length && end < FIXTURE_STATIONS.length) pageInfo.after = encode(items.at(-1)!.id);
    if (items.length && start > 0) pageInfo.before = encode(items[0]!.id);

    return HttpResponse.json({ items, pageInfo });
  }),

  http.get('/api/stations/:id/readings', ({ params }) => {
    const station = FIXTURE_STATIONS.find((s) => s.id === params['id']);
    if (!station) return HttpResponse.json({ error: 'unknown station' }, { status: 404 });
    return HttpResponse.json(seriesFor(station));
  }),
];

/** Makes every endpoint fail, for the error-state tests. */
export const failingHandlers = [
  http.get('/api/*', () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
];
