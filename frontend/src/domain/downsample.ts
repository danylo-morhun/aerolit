import { DISPLAY_TIME_ZONE } from './format';
import {
  HOUR_MS,
  RANGE_HOURS,
  startsLocalDay,
  windowStart,
  zonedDayStart,
  zonedHour,
} from './time';
import type { ChartRange, ReadingSeries } from './types';

/** One plotted interval. `null` means the interval has no data at all. */
export interface ChartPoint {
  /** Bucket start, epoch ms — where the bar sits on the axis. */
  readonly t: number;
  /**
   * The span the bar's mean actually covers, clamped to the window at both
   * ends. A range that opens at 15:00 gives its first day a bar that runs from
   * 15:00, not from midnight, and saying "00:00–24:00" over nine hours of data
   * would be the same kind of lie the calendar cut exists to remove.
   */
  readonly coveredFrom: number;
  /** First instant after the covered span. */
  readonly coveredTo: number;
  readonly pm25: number | null;
  readonly pm10: number | null;
}

/**
 * What one bar covers, per range.
 *
 * 24H plots raw hourly readings, as the mockup does. 7D and 30D are bucketed:
 * 720 bars across a chart a few hundred pixels wide would be sub-pixel slivers
 * that imply a precision the eye cannot read, and a 30-day pollution trend is a
 * question about days, not hours.
 *
 * The longer two are cut on the *local* clock rather than measured back from
 * the snapshot instant. A 30-day chart whose bars run 15:00 to 15:00 and are
 * labelled with a date says "12 Jun" over a bar that is mostly the 13th; a
 * daily mean is a calendar day everywhere else in air quality, including the
 * limit values the regulator publishes. The price is a partial bar at each end,
 * which is honest — the day at the right-hand edge really is still in progress.
 */
export type BucketUnit = 'hour' | 'sixHours' | 'day';

export const BUCKET_UNIT: Readonly<Record<ChartRange, BucketUnit>> = {
  '24h': 'hour',
  '7d': 'sixHours',
  '30d': 'day',
};

/** Local clock times the 7D bars are cut at. */
const SIX_HOUR_MARKS = [0, 6, 12, 18];

/**
 * Local midnights from the day containing `from` to the day containing `to`.
 *
 * Stepping by 26 hours and snapping back to midnight is what keeps this correct
 * across the two days a year that are 23 or 25 hours long: the step always
 * lands inside the following day, never skips one and never repeats one.
 */
function localDayStarts(from: number, to: number, timeZone: string): number[] {
  const starts: number[] = [];
  let day = zonedDayStart(from, timeZone);

  while (day <= to) {
    starts.push(day);
    day = zonedDayStart(day + 26 * HOUR_MS, timeZone);
  }
  return starts;
}

export interface BoundaryInput {
  readonly from: number;
  readonly to: number;
  readonly unit: BucketUnit;
  readonly timeZone?: string;
}

/**
 * Bucket start instants covering `[from, to]`, ascending.
 *
 * The first boundary may sit before `from` — that bucket is the partial one the
 * window opens in the middle of.
 */
export function bucketBoundaries({
  from,
  to,
  unit,
  timeZone = DISPLAY_TIME_ZONE,
}: BoundaryInput): number[] {
  if (to < from) return [];

  if (unit === 'hour') {
    const starts: number[] = [];
    for (let t = from; t <= to; t += HOUR_MS) starts.push(t);
    return starts;
  }

  const days = localDayStarts(from, to, timeZone);
  const starts =
    unit === 'day'
      ? days
      : days.flatMap((day, index) => {
          const nextDay = days[index + 1] ?? day + 26 * HOUR_MS;
          return SIX_HOUR_MARKS.map((mark) => day + mark * HOUR_MS).filter(
            (start) => start < nextDay,
          );
        });

  // Drop whole buckets that end before the window opens, and any that start
  // after it closes; what remains is exactly what the axis should show.
  return starts.filter((start, index) => start <= to && (starts[index + 1] ?? to + 1) > from);
}

export interface BucketInput {
  readonly series: ReadingSeries;
  readonly from: number;
  readonly to: number;
  readonly unit: BucketUnit;
  readonly timeZone?: string;
}

/**
 * Averages a series into the buckets spanning `[from, to]`.
 *
 * Every bucket in the range is emitted whether or not the station reported in
 * it, so an outage stays visible as a gap instead of being closed up — which
 * would make a broken sensor look like a working one with less data.
 */
export function bucketSeries({ series, from, to, unit, timeZone }: BucketInput): ChartPoint[] {
  const starts = bucketBoundaries({ from, to, unit, ...(timeZone ? { timeZone } : {}) });
  if (starts.length === 0) return [];

  const sums = starts.map(() => ({ pm25: 0, pm10: 0, n: 0 }));

  let index = 0;
  for (const reading of series) {
    if (reading.t < from || reading.t > to) continue;
    while (index + 1 < starts.length && starts[index + 1]! <= reading.t) index += 1;
    while (index > 0 && starts[index]! > reading.t) index -= 1;

    const bucket = sums[index];
    if (bucket === undefined) continue;
    bucket.pm25 += reading.pm25;
    bucket.pm10 += reading.pm10;
    bucket.n += 1;
  }

  // The last hourly reading stands for the hour it opens, so the window closes
  // an hour after the final stamp rather than on it.
  const windowEnd = to + HOUR_MS;

  return starts.map((start, i) => ({
    t: start,
    coveredFrom: Math.max(start, from),
    coveredTo: Math.min(starts[i + 1] ?? windowEnd, windowEnd),
    pm25: sums[i]!.n === 0 ? null : sums[i]!.pm25 / sums[i]!.n,
    pm10: sums[i]!.n === 0 ? null : sums[i]!.pm10 / sums[i]!.n,
  }));
}

/** The plotted series for a chart range ending at `now`. */
export function chartSeries(
  series: ReadingSeries,
  range: ChartRange,
  now: number,
  timeZone?: string,
): ChartPoint[] {
  return bucketSeries({
    series,
    from: windowStart(now, RANGE_HOURS[range]),
    to: now,
    unit: BUCKET_UNIT[range],
    ...(timeZone ? { timeZone } : {}),
  });
}

/**
 * Whether a bar opens a local day — the 7D axis labels those and leaves the
 * three intermediate bars unlabelled, so the dates below the chart line up with
 * the day boundaries instead of drifting with the window.
 */
export function opensLocalDay(t: number, timeZone: string = DISPLAY_TIME_ZONE): boolean {
  return startsLocalDay(t, timeZone);
}

/** The bar's local start hour, for labelling a sub-day bucket. */
export function localHourOf(t: number, timeZone: string = DISPLAY_TIME_ZONE): number {
  return zonedHour(t, timeZone);
}
