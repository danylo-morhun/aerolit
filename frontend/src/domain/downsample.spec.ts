import { describe, expect, it } from 'vitest';

import { buildSeries, SNAPSHOT_NOW } from '../../tests/factories';
import { BUCKET_HOURS, bucketSeries, chartSeries } from './downsample';
import { HOUR_MS, RANGE_HOURS } from './time';

describe('chartSeries', () => {
  it('plots 24H at raw hourly resolution', () => {
    const points = chartSeries(buildSeries({ hours: 720 }), '24h', SNAPSHOT_NOW);
    expect(points).toHaveLength(24);
    expect(points.at(-1)?.t).toBe(SNAPSHOT_NOW);
  });

  it('keeps every range at a readable number of bars', () => {
    const series = buildSeries({ hours: 720 });
    expect(chartSeries(series, '7d', SNAPSHOT_NOW)).toHaveLength(RANGE_HOURS['7d'] / 6);
    expect(chartSeries(series, '30d', SNAPSHOT_NOW)).toHaveLength(RANGE_HOURS['30d'] / 24);
  });

  it('averages the readings inside a bucket', () => {
    // 6-hour buckets over a ramp: the first bucket averages slots 0..5.
    const series = buildSeries({ hours: RANGE_HOURS['7d'], pm25: (slot) => slot });
    const points = chartSeries(series, '7d', SNAPSHOT_NOW);
    expect(points[0]?.pm25).toBe((0 + 1 + 2 + 3 + 4 + 5) / 6);
  });

  it('anchors the last bucket on the snapshot instant', () => {
    const points = chartSeries(buildSeries({ hours: 720 }), '30d', SNAPSHOT_NOW);
    const lastBucketStart = SNAPSHOT_NOW - (RANGE_HOURS['30d'] - 1) * HOUR_MS + 29 * 24 * HOUR_MS;
    expect(points.at(-1)?.t).toBe(lastBucketStart);
  });
});

describe('bucketSeries', () => {
  const from = SNAPSHOT_NOW - 11 * HOUR_MS;

  it('leaves an outage as a visible gap', () => {
    // Closing the gap would make a broken sensor look like a working one that
    // simply reported less often.
    const series = buildSeries({ hours: 12, missing: [4, 5, 6, 7] });
    const points = bucketSeries({ series, from, to: SNAPSHOT_NOW, bucketHours: 4 });

    expect(points).toHaveLength(3);
    expect(points[1]).toMatchObject({ pm25: null, pm10: null });
    expect(points[0]?.pm25).not.toBeNull();
    expect(points[2]?.pm25).not.toBeNull();
  });

  it('ignores readings outside the window', () => {
    const series = buildSeries({ hours: 48, pm25: () => 5 });
    const points = bucketSeries({ series, from, to: SNAPSHOT_NOW, bucketHours: 12 });
    expect(points).toHaveLength(1);
    expect(points[0]?.pm25).toBe(5);
  });

  it('returns an all-null axis for an empty series', () => {
    const points = bucketSeries({ series: [], from, to: SNAPSHOT_NOW, bucketHours: 6 });
    expect(points).toHaveLength(2);
    expect(points.every((p) => p.pm25 === null && p.pm10 === null)).toBe(true);
  });

  it('produces evenly spaced bucket starts', () => {
    const points = bucketSeries({
      series: buildSeries({ hours: 12 }),
      from,
      to: SNAPSHOT_NOW,
      bucketHours: 3,
    });
    const gaps = points.slice(1).map((point, i) => point.t - points[i]!.t);
    expect(new Set(gaps)).toEqual(new Set([3 * HOUR_MS]));
  });
});

describe('BUCKET_HOURS', () => {
  it('divides each range into whole buckets', () => {
    for (const [range, hours] of Object.entries(RANGE_HOURS)) {
      const bucket = BUCKET_HOURS[range as keyof typeof BUCKET_HOURS];
      expect(hours % bucket).toBe(0);
    }
  });
});
