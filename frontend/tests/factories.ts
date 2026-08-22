import { HOUR_MS } from '@/domain/time';
import type { Reading } from '@/domain/types';

/** The snapshot instant of the shipped dataset, handy as a realistic anchor. */
export const SNAPSHOT_NOW = Date.parse('2026-07-11T12:00:00Z');
export const SNAPSHOT_START = Date.parse('2026-06-11T13:00:00Z');

export interface SeriesOptions {
  /** Hour of the last reading in the series. */
  readonly endingAt?: number;
  /** Number of hourly slots the series spans, including both ends. */
  readonly hours: number;
  /** Slot offsets (0 = oldest) to drop, simulating missed submissions. */
  readonly missing?: readonly number[];
  readonly pm25?: (slot: number) => number;
  readonly pm10?: (slot: number) => number;
}

/**
 * Builds an hourly series ending at `endingAt`.
 *
 * Slots listed in `missing` are omitted entirely rather than zero-filled,
 * which is how the real dataset represents a dropped submission.
 */
export function buildSeries({
  endingAt = SNAPSHOT_NOW,
  hours,
  missing = [],
  pm25 = () => 20,
  pm10 = () => 40,
}: SeriesOptions): Reading[] {
  const skip = new Set(missing);
  const start = endingAt - (hours - 1) * HOUR_MS;

  const readings: Reading[] = [];
  for (let slot = 0; slot < hours; slot += 1) {
    if (skip.has(slot)) continue;
    readings.push({ t: start + slot * HOUR_MS, pm25: pm25(slot), pm10: pm10(slot) });
  }
  return readings;
}
