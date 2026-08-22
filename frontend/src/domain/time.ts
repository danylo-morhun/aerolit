import type { ChartRange } from './types';

export const HOUR_MS = 3_600_000;

export const RANGE_HOURS: Readonly<Record<ChartRange, number>> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

/**
 * Hours in the inclusive window `[from, to]`.
 *
 * Inclusive because a healthy station reports "one reading per hour, on the
 * hour": a window from 12:00 to 13:00 expects two readings, not one. Getting
 * this off by one shifts every stability figure in the app, so it lives in one
 * function with its own tests.
 */
export function hoursInWindow(from: number, to: number): number {
  if (to < from) return 0;
  return Math.floor((to - from) / HOUR_MS) + 1;
}

/** Start of the trailing window of `hours` ending at and including `to`. */
export function windowStart(to: number, hours: number): number {
  return to - (hours - 1) * HOUR_MS;
}

/** Snaps an instant down to the top of its hour. */
export function floorToHour(t: number): number {
  return Math.floor(t / HOUR_MS) * HOUR_MS;
}
