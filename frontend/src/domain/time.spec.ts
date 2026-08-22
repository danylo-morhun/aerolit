import { describe, expect, it } from 'vitest';

import { floorToHour, HOUR_MS, hoursInWindow, RANGE_HOURS, windowStart } from './time';

const at = (iso: string) => Date.parse(iso);

describe('hoursInWindow', () => {
  it('counts both ends of the window', () => {
    // A station reporting on the hour owes a reading at 12:00 AND at 13:00.
    expect(hoursInWindow(at('2026-07-11T12:00:00Z'), at('2026-07-11T13:00:00Z'))).toBe(2);
  });

  it('counts a single instant as one hour', () => {
    const t = at('2026-07-11T12:00:00Z');
    expect(hoursInWindow(t, t)).toBe(1);
  });

  it('matches the dataset: 30 days of hourly readings is 720', () => {
    expect(hoursInWindow(at('2026-06-11T13:00:00Z'), at('2026-07-11T12:00:00Z'))).toBe(720);
  });

  it('returns zero for an inverted window', () => {
    expect(hoursInWindow(at('2026-07-11T13:00:00Z'), at('2026-07-11T12:00:00Z'))).toBe(0);
  });
});

describe('windowStart', () => {
  it('is the inverse of hoursInWindow', () => {
    const now = at('2026-07-11T12:00:00Z');
    for (const hours of Object.values(RANGE_HOURS)) {
      expect(hoursInWindow(windowStart(now, hours), now)).toBe(hours);
    }
  });

  it('places a 24 h window one day back minus one hour', () => {
    const now = at('2026-07-11T12:00:00Z');
    expect(windowStart(now, 24)).toBe(at('2026-07-10T13:00:00Z'));
  });
});

describe('floorToHour', () => {
  it('snaps down to the top of the hour', () => {
    expect(floorToHour(at('2026-07-11T12:59:59Z'))).toBe(at('2026-07-11T12:00:00Z'));
    expect(floorToHour(at('2026-07-11T12:00:00Z'))).toBe(at('2026-07-11T12:00:00Z'));
  });
});

describe('RANGE_HOURS', () => {
  it('is expressed in whole hours', () => {
    expect(RANGE_HOURS).toEqual({ '24h': 24, '7d': 168, '30d': 720 });
    expect(HOUR_MS).toBe(3_600_000);
  });
});
