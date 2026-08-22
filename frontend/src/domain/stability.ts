import { hoursInWindow, RANGE_HOURS, windowStart } from './time';
import type { ConnectionState, ReadingSeries } from './types';

/** Stability at or above this share counts as a high-quality link. */
export const HQ_LINK_THRESHOLD = 0.86;

/** The window a station's headline stability % is measured over. */
export const STABILITY_WINDOW_HOURS = RANGE_HOURS['30d'];

export interface StabilityInput {
  readonly series: ReadingSeries;
  /** Snapshot instant: the most recent hour the network reported. */
  readonly now: number;
  /**
   * Earliest hour present anywhere in the dataset. Used to clamp the expected
   * count so a window reaching past the start of history isn't scored against
   * hours that could never have been recorded — see `stabilityAt`.
   */
  readonly dataStart: number;
  readonly windowHours?: number;
}

/**
 * Share of expected hourly readings a station actually reported, 0–1.
 *
 * "Expected" is every hour in the trailing window, clamped to the start of
 * available history. That clamp is what makes the KPI trend badges honest: the
 * week-over-week figure re-runs this calculation anchored at now − 168 h, and
 * a 30-day window from there reaches 168 hours before the dataset begins.
 * Without the clamp every station would be scored against 720 hours while only
 * 552 were ever observable, dragging the reference stability down by ~23
 * points and inventing a network-wide improvement that never happened.
 */
export function stabilityAt({
  series,
  now,
  dataStart,
  windowHours = STABILITY_WINDOW_HOURS,
}: StabilityInput): number {
  const from = Math.max(windowStart(now, windowHours), dataStart);
  const expected = hoursInWindow(from, now);
  if (expected <= 0) return 0;

  const present = countReadingsInWindow(series, from, now);
  return Math.min(present / expected, 1);
}

/**
 * Readings whose timestamp falls in `[from, to]`.
 *
 * The series is sorted ascending, so this is a two-ended scan rather than a
 * filter over the whole array: at 240 stations × 720 readings the difference
 * is measurable, and every KPI recomputation walks all of them twice.
 */
export function countReadingsInWindow(series: ReadingSeries, from: number, to: number): number {
  let count = 0;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const t = series[i]?.t;
    if (t === undefined) continue;
    if (t > to) continue;
    if (t < from) break;
    count += 1;
  }
  return count;
}

/**
 * Connection state at a given instant.
 *
 * Offline is checked first and independently of stability, per the brief: a
 * station that missed the most recent expected hour is offline "whatever the
 * stability %", because the operator needs to know it is silent *now*, not how
 * dependable it used to be.
 */
export function connectionAt(input: StabilityInput): ConnectionState {
  if (!hasReadingAtHour(input.series, input.now)) return 'offline';
  return stabilityAt(input) >= HQ_LINK_THRESHOLD ? 'hq' : 'poor';
}

/** Whether the station reported for the exact hour `hour`. */
export function hasReadingAtHour(series: ReadingSeries, hour: number): boolean {
  const last = series[series.length - 1];
  if (last === undefined) return false;
  // Fast path: the overwhelmingly common case is checking the latest hour.
  if (last.t === hour) return true;
  if (last.t < hour) return false;
  return countReadingsInWindow(series, hour, hour) > 0;
}
