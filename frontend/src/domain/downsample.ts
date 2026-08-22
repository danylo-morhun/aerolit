import { HOUR_MS, RANGE_HOURS, windowStart } from './time';
import type { ChartRange, ReadingSeries } from './types';

/** One plotted interval. `null` means the interval has no data at all. */
export interface ChartPoint {
  /** Bucket start, epoch ms. */
  readonly t: number;
  readonly pm25: number | null;
  readonly pm10: number | null;
}

/**
 * Hours per plotted bar, per range.
 *
 * 24H plots raw hourly readings, as the mockup does. 7D and 30D are bucketed:
 * 720 bars across a chart a few hundred pixels wide would be sub-pixel slivers
 * that imply a precision the eye cannot read, and a 30-day pollution trend is
 * a question about days, not hours. The bucket sizes keep every range at a
 * comparable ~24–30 bars.
 */
export const BUCKET_HOURS: Readonly<Record<ChartRange, number>> = {
  '24h': 1,
  '7d': 6,
  '30d': 24,
};

export interface BucketInput {
  readonly series: ReadingSeries;
  readonly from: number;
  readonly to: number;
  readonly bucketHours: number;
}

/**
 * Averages a series into fixed-width buckets spanning `[from, to]`.
 *
 * Buckets are laid out from `from` regardless of where readings fall, so every
 * interval appears on the axis even when the station reported nothing in it —
 * an outage stays visible as a gap instead of being closed up, which would
 * make a broken sensor look like a working one with less data.
 */
export function bucketSeries({ series, from, to, bucketHours }: BucketInput): ChartPoint[] {
  const bucketMs = bucketHours * HOUR_MS;
  const count = Math.max(0, Math.ceil((to - from + HOUR_MS) / bucketMs));

  const sums = Array.from({ length: count }, () => ({ pm25: 0, pm10: 0, n: 0 }));

  for (const reading of series) {
    if (reading.t < from || reading.t > to) continue;
    const index = Math.floor((reading.t - from) / bucketMs);
    const bucket = sums[index];
    if (bucket === undefined) continue;
    bucket.pm25 += reading.pm25;
    bucket.pm10 += reading.pm10;
    bucket.n += 1;
  }

  return sums.map((bucket, index) => ({
    t: from + index * bucketMs,
    pm25: bucket.n === 0 ? null : bucket.pm25 / bucket.n,
    pm10: bucket.n === 0 ? null : bucket.pm10 / bucket.n,
  }));
}

/** The plotted series for a chart range ending at `now`. */
export function chartSeries(series: ReadingSeries, range: ChartRange, now: number): ChartPoint[] {
  const hours = RANGE_HOURS[range];
  return bucketSeries({
    series,
    from: windowStart(now, hours),
    to: now,
    bucketHours: BUCKET_HOURS[range],
  });
}
