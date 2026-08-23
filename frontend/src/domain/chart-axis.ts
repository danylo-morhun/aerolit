import { BUCKET_UNIT, opensLocalDay, type ChartPoint } from './downsample';
import { formatDateTime, formatDay, formatHour } from './format';
import type { ChartRange } from './types';

/**
 * How the chart labels itself.
 *
 * Lives here rather than in the component for the same reason every other
 * derived value does: what a bar *covers* is a statement about the data, and
 * the rule that decides it should be testable without mounting ECharts.
 *
 * The window is always trailing — 24H ends at the snapshot hour, not at
 * midnight — while the bars inside it are cut on the Berlin clock for the two
 * bucketed ranges. That combination is deliberate (ADR 0010) and it puts a day
 * boundary somewhere in the middle of every range, including 24H. Every range
 * therefore labels the bar that opens a local day with its date, so the
 * boundary is visible wherever it lands.
 */

/** Roughly how many labels fit under the chart before they collide. */
const MAX_LABELS = 9;

function stepFor(count: number): number {
  return Math.max(1, Math.ceil(count / MAX_LABELS));
}

/**
 * One axis label per bar; `''` leaves that bar unlabelled.
 *
 * - **24H** — hourly bars, thinned to fit, plus the date on the single bar
 *   that opens a day. An hour label adjacent to that date is dropped so the
 *   two never overprint.
 * - **7D** — six-hourly bars; only the four-bar day openings carry a date, so
 *   the dates sit exactly on the day boundaries instead of drifting.
 * - **30D** — every bar is a day, so the dates are thinned like the hours are.
 */
export function axisLabels(points: readonly ChartPoint[], range: ChartRange): string[] {
  const opensDay = points.map((point) => opensLocalDay(point.t));
  const hourly = BUCKET_UNIT[range] === 'hour';
  // 30D labels a date on every bar and needs thinning; 24H and 7D do not,
  // because a day opens at most once every four bars in either.
  const dayStep = BUCKET_UNIT[range] === 'day' ? stepFor(points.length) : 1;
  const hourStep = stepFor(points.length);

  return points.map((point, index) => {
    if (opensDay[index]) return index % dayStep === 0 ? formatDay(point.t) : '';
    if (!hourly) return '';
    if (index % hourStep !== 0) return '';
    // Never print an hour immediately beside a date.
    if (opensDay[index - 1] === true || opensDay[index + 1] === true) return '';
    return formatHour(point.t);
  });
}

/**
 * What one bar covers, spelled out for the tooltip.
 *
 * An hourly bar is a single reading, so it is named by its instant. A bucketed
 * one is a mean over a span, and saying so is the difference between a tooltip
 * and a guess: a day that ran to midnight reads "00:00–24:00" rather than
 * "00:00–00:00", and the partial bars at either end of a trailing window read
 * as the part-days they are.
 */
export function bucketSpanLabel(point: ChartPoint, range: ChartRange): string {
  if (BUCKET_UNIT[range] === 'hour') return formatDateTime(point.t);

  const end = formatHour(point.coveredTo);
  return `${formatDay(point.coveredFrom)} ${formatHour(point.coveredFrom)}–${end === '00:00' ? '24:00' : end}`;
}
