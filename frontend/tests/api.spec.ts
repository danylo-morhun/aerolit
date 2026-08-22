import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ApiError } from '@/api/client';
import { mapWithConcurrency } from '@/api/concurrency';
import {
  fetchReadingCount,
  fetchReadings,
  fetchStationCount,
  fetchStationPage,
  MAX_PAGE_SIZE,
} from '@/api/stations';

import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchStationPage', () => {
  it('maps items and surfaces both cursors as-is', async () => {
    const page = await fetchStationPage({ limit: 2 });

    expect(page.items.map((s) => s.id)).toEqual(['BLN-0001', 'BLN-0002']);
    expect(page.prevCursor).toBeUndefined(); // first page
    expect(page.nextCursor).toBeDefined();
  });

  it('follows a cursor forward and back to the same page', async () => {
    const first = await fetchStationPage({ limit: 1 });
    const second = await fetchStationPage({ limit: 1, after: first.nextCursor });
    const back = await fetchStationPage({ limit: 1, before: second.prevCursor });

    expect(second.items[0]?.id).toBe('BLN-0002');
    expect(back.items[0]?.id).toBe('BLN-0001');
  });

  it('omits the forward cursor on the last page', async () => {
    const page = await fetchStationPage({ limit: MAX_PAGE_SIZE });

    expect(page.nextCursor).toBeUndefined();
  });
});

describe('fetchReadings', () => {
  it('converts ISO timestamps to epoch milliseconds at the boundary', async () => {
    const readings = await fetchReadings('BLN-0001');

    expect(typeof readings[0]?.t).toBe('number');
    expect(new Date(readings.at(-1)!.t).toISOString()).toBe('2026-07-11T12:00:00.000Z');
  });

  it('raises an ApiError carrying the status for an unknown station', async () => {
    await expect(fetchReadings('BLN-9999')).rejects.toBeInstanceOf(ApiError);
    await expect(fetchReadings('BLN-9999')).rejects.toMatchObject({ status: 404 });
  });

  it('explains a network failure in terms the UI can show', async () => {
    server.use(http.get('/api/stations/:id/readings', () => HttpResponse.error()));

    await expect(fetchReadings('BLN-0001')).rejects.toMatchObject({
      status: null,
      message: expect.stringContaining('8787'),
    });
  });
});

describe('count endpoints', () => {
  it('reads the network total', async () => {
    await expect(fetchStationCount()).resolves.toBe(3);
  });

  it('reads a station tally for a window', async () => {
    server.use(
      http.get('/api/stations/:id/readings/count', ({ request }) => {
        const url = new URL(request.url, 'http://localhost');
        return HttpResponse.json({ count: url.searchParams.get('range') === '24h' ? 24 : 720 });
      }),
    );

    await expect(fetchReadingCount('BLN-0001', { range: '24h' })).resolves.toBe(24);
    await expect(fetchReadingCount('BLN-0001')).resolves.toBe(720);
  });

  it('escapes ids so a path never breaks out of its segment', async () => {
    server.use(
      http.get('/api/stations/:id/readings', ({ params }) =>
        HttpResponse.json([{ t: '2026-07-11T12:00:00Z', pm25: 1, pm10: 2 }, { id: params['id'] }]),
      ),
    );

    await expect(fetchReadings('a/b')).resolves.toHaveLength(2);
  });
});

describe('mapWithConcurrency', () => {
  it('preserves input order regardless of completion order', async () => {
    const delays = [30, 5, 20, 1];
    const result = await mapWithConcurrency(delays, 2, async (ms, index) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return index;
    });

    expect(result).toEqual([0, 1, 2, 3]);
  });

  it('never exceeds the requested number in flight', async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      3,
      async (value) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return value;
      },
    );

    expect(peak).toBeLessThanOrEqual(3);
  });

  it('handles an empty input without hanging', async () => {
    await expect(mapWithConcurrency([], 4, async (v) => v)).resolves.toEqual([]);
  });
});
