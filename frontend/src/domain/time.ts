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

/**
 * Wall-clock arithmetic for a named zone.
 *
 * The chart's daily bars are Berlin days, not 24-hour windows measured back
 * from the snapshot — a "daily mean" that runs 15:00 to 15:00 is not the figure
 * anyone means by that phrase, and the axis labels it with a date either way.
 * Doing that properly means asking what the wall clock said at an instant,
 * which `Intl` answers without any ambient state: same input, same output,
 * everywhere, so this stays as pure as the rest of the layer.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
}

function zonedParts(t: number, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(t);
  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    // `hour12: false` renders midnight as 24 in some engines.
    hour: value('hour') % 24,
  };
}

/** The hour on the wall clock, 0–23. */
export function zonedHour(t: number, timeZone: string): number {
  return zonedParts(t, timeZone).hour;
}

/** How far the zone runs ahead of UTC at this instant, in milliseconds. */
function zonedOffset(t: number, timeZone: string): number {
  const { year, month, day, hour } = zonedParts(t, timeZone);
  const parts = formatterFor(timeZone).formatToParts(t);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  const second = Number(parts.find((part) => part.type === 'second')?.value ?? '0');

  return Date.UTC(year, month - 1, day, hour, minute, second) - Math.floor(t / 1000) * 1000;
}

/**
 * Midnight local time on the day containing `t`.
 *
 * Resolved in two passes: the offset is read at `t`, used to guess the instant,
 * then read again at that guess. The second pass is what makes the two days a
 * year when the offset changes come out right instead of an hour off.
 */
export function zonedDayStart(t: number, timeZone: string): number {
  const { year, month, day } = zonedParts(t, timeZone);
  const midnight = Date.UTC(year, month - 1, day);
  const guess = midnight - zonedOffset(t, timeZone);
  return midnight - zonedOffset(guess, timeZone);
}

/** Whether this instant is exactly local midnight. */
export function startsLocalDay(t: number, timeZone: string): boolean {
  return zonedDayStart(t, timeZone) === t;
}
