import { describe, expect, it } from 'vitest';

import { buildSeries, SNAPSHOT_NOW } from '../../tests/factories';
import { bucketBoundaries, bucketSeries, chartSeries } from './downsample';
import { DISPLAY_TIME_ZONE } from './format';
import { HOUR_MS, RANGE_HOURS } from './time';

const berlinHour = (t: number): string =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: DISPLAY_TIME_ZONE,
  }).format(t);

describe('chartSeries', () => {
  it('plots 24H at raw hourly resolution', () => {
    const points = chartSeries(buildSeries({ hours: 720 }), '24h', SNAPSHOT_NOW);
    expect(points).toHaveLength(24);
    expect(points.at(-1)?.t).toBe(SNAPSHOT_NOW);
  });

  /**
   * The bars an operator reads as "days" have to be days on the clock they
   * work by. Cutting them 24 hours back from the snapshot instead would put
   * roughly half of the 12th under a bar labelled the 11th.
   */
  it('cuts the 30D bars at local midnight, not at the snapshot hour', () => {
    const points = chartSeries(buildSeries({ hours: 720 }), '30d', SNAPSHOT_NOW);

    for (const point of points) expect(berlinHour(point.t)).toBe('00:00');
  });

  it('cuts the 7D bars at 00, 06, 12 and 18 local', () => {
    const points = chartSeries(buildSeries({ hours: 720 }), '7d', SNAPSHOT_NOW);

    for (const point of points)
      expect(['00:00', '06:00', '12:00', '18:00']).toContain(berlinHour(point.t));
  });

  it('keeps every range to a readable number of bars', () => {
    const series = buildSeries({ hours: 720 });

    // A calendar cut means a partial bucket at each end, so the count is the
    // window's worth of whole buckets plus at most one.
    expect(chartSeries(series, '7d', SNAPSHOT_NOW).length).toBeLessThanOrEqual(
      RANGE_HOURS['7d'] / 6 + 1,
    );
    expect(chartSeries(series, '30d', SNAPSHOT_NOW).length).toBeLessThanOrEqual(
      RANGE_HOURS['30d'] / 24 + 1,
    );
  });

  it('clamps the outer bars to the window they are cut from', () => {
    const points = chartSeries(buildSeries({ hours: 720 }), '30d', SNAPSHOT_NOW);
    const from = SNAPSHOT_NOW - (RANGE_HOURS['30d'] - 1) * HOUR_MS;

    // The first day is only in the range from the hour the window opens, and
    // the last one has not finished yet.
    expect(points[0]?.t).toBeLessThan(from);
    expect(points[0]?.coveredFrom).toBe(from);
    expect(points.at(-1)?.coveredTo).toBe(SNAPSHOT_NOW + HOUR_MS);
  });

  it('averages the readings inside a bucket', () => {
    const series = buildSeries({ hours: RANGE_HOURS['30d'], pm25: (slot) => slot });
    const points = chartSeries(series, '30d', SNAPSHOT_NOW);

    // Every bar is the mean of the slots that fall in its day, and the ramp
    // makes that arithmetic checkable by hand.
    for (const point of points) {
      const slots = series.filter((r) => r.t >= point.coveredFrom && r.t < point.coveredTo);
      if (slots.length === 0) continue;
      const mean = slots.reduce((sum, r) => sum + r.pm25, 0) / slots.length;
      expect(point.pm25).toBeCloseTo(mean, 10);
    }
  });
});

describe('bucketBoundaries', () => {
  /**
   * Europe/Berlin loses an hour on 29 March 2026 and gains one on 25 October.
   * Stepping in fixed 24-hour jumps would drift by an hour and eventually
   * duplicate or skip a day; these two are the days that prove it does not.
   */
  it('keeps one bar per day across the spring-forward day', () => {
    const from = Date.parse('2026-03-27T00:00:00Z');
    const to = Date.parse('2026-03-31T12:00:00Z');
    const starts = bucketBoundaries({ from, to, unit: 'day' });

    expect(starts.map(berlinHour)).toEqual(Array(starts.length).fill('00:00'));
    expect(new Set(starts).size).toBe(starts.length);
    // 23-hour day: the gap between two of the boundaries is an hour short.
    expect(starts.some((t, i) => i > 0 && t - starts[i - 1]! === 23 * HOUR_MS)).toBe(true);
  });

  it('keeps one bar per day across the autumn fall-back day', () => {
    const from = Date.parse('2026-10-23T00:00:00Z');
    const to = Date.parse('2026-10-27T12:00:00Z');
    const starts = bucketBoundaries({ from, to, unit: 'day' });

    expect(starts.map(berlinHour)).toEqual(Array(starts.length).fill('00:00'));
    expect(starts.some((t, i) => i > 0 && t - starts[i - 1]! === 25 * HOUR_MS)).toBe(true);
  });

  it('opens with the bucket the window starts inside', () => {
    const from = Date.parse('2026-06-11T13:00:00Z');
    const to = Date.parse('2026-06-13T12:00:00Z');
    const starts = bucketBoundaries({ from, to, unit: 'day' });

    // 13:00 UTC is 15:00 in Berlin, so the first bar is that day's, already
    // running when the window opens.
    expect(starts[0]).toBeLessThan(from);
    expect(starts).toHaveLength(3);
  });

  it('follows the zone it is given', () => {
    const from = Date.parse('2026-06-11T13:00:00Z');
    const to = Date.parse('2026-06-12T12:00:00Z');

    const berlin = bucketBoundaries({ from, to, unit: 'day' });
    const utc = bucketBoundaries({ from, to, unit: 'day', timeZone: 'UTC' });

    expect(new Date(berlin[0]!).toISOString()).toBe('2026-06-10T22:00:00.000Z');
    expect(new Date(utc[0]!).toISOString()).toBe('2026-06-11T00:00:00.000Z');
  });
});

describe('bucketSeries', () => {
  const from = SNAPSHOT_NOW - 11 * HOUR_MS;

  it('leaves an outage as a visible gap', () => {
    // Closing the gap would make a broken sensor look like a working one that
    // simply reported less often.
    const series = buildSeries({ hours: 12, missing: [4, 5, 6, 7] });
    const points = bucketSeries({ series, from, to: SNAPSHOT_NOW, unit: 'hour' });

    expect(points).toHaveLength(12);
    expect(points.filter((p) => p.pm25 === null)).toHaveLength(4);
  });

  it('ignores readings outside the window', () => {
    const series = buildSeries({ hours: 48, pm25: () => 5 });
    const points = bucketSeries({ series, from, to: SNAPSHOT_NOW, unit: 'hour' });

    expect(points).toHaveLength(12);
    expect(points.every((point) => point.pm25 === 5)).toBe(true);
  });

  it('returns nothing for an inverted window', () => {
    expect(
      bucketSeries({
        series: buildSeries({ hours: 4 }),
        from: SNAPSHOT_NOW,
        to: from,
        unit: 'day',
      }),
    ).toEqual([]);
  });
});
