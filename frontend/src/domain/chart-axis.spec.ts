import { describe, expect, it } from 'vitest';

import { buildSeries, SNAPSHOT_NOW } from '../../tests/factories';
import { axisLabels, bucketSpanLabel } from './chart-axis';
import { chartSeries, type ChartPoint } from './downsample';
import { formatDay } from './format';
import { HOUR_MS } from './time';

const series = buildSeries({ hours: 720 });

const labelled = (labels: readonly string[]): string[] => labels.filter((label) => label !== '');

/** Local midnight on 11 July 2026, in Berlin. */
const BERLIN_MIDNIGHT = Date.parse('2026-07-10T22:00:00Z');

/** 24 hourly bars with local midnight landing on a chosen index. */
function hourlyBars(midnightAt: number, count = 24): ChartPoint[] {
  const start = BERLIN_MIDNIGHT - midnightAt * HOUR_MS;
  return Array.from({ length: count }, (_, index) => ({
    t: start + index * HOUR_MS,
    coveredFrom: start + index * HOUR_MS,
    coveredTo: start + (index + 1) * HOUR_MS,
    pm25: 10,
    pm10: 20,
  }));
}

describe('axisLabels', () => {
  it('returns one entry per bar in every range', () => {
    for (const range of ['24h', '7d', '30d'] as const) {
      const points = chartSeries(series, range, SNAPSHOT_NOW);
      expect(axisLabels(points, range)).toHaveLength(points.length);
    }
  });

  /**
   * The trailing 24-hour window crosses midnight somewhere in the middle. With
   * hours alone on the axis, "03:00" gives no clue which day it belongs to —
   * the date on the boundary bar is what makes the crossing readable.
   */
  it('dates the bar that opens a day inside the 24H window', () => {
    const points = chartSeries(series, '24h', SNAPSHOT_NOW);
    const labels = axisLabels(points, '24h');

    const boundary = points.findIndex((point) => point.t === Date.parse('2026-07-10T22:00:00Z'));
    expect(boundary).toBeGreaterThan(-1); // 00:00 Berlin on 11 Jul
    expect(labels[boundary]).toBe(formatDay(points[boundary]!.t));
  });

  it('never prints an hour next to that date', () => {
    const points = chartSeries(series, '24h', SNAPSHOT_NOW);
    const labels = axisLabels(points, '24h');
    const boundary = labels.findIndex((label) => label.includes('Jul'));

    expect(labels[boundary - 1]).toBe('');
    expect(labels[boundary + 1]).toBe('');
  });

  /**
   * The hour labels fall on an even stride and the date falls where midnight
   * lands, so the two can collide from either side. Both are suppressed —
   * tested separately, because a rule that only checks one neighbour reads as
   * correct until the window drifts by an hour.
   */
  it('suppresses an hour label on the bar after the date', () => {
    // Midnight at index 2; index 3 is a stride position and sits right after it.
    const labels = axisLabels(hourlyBars(2), '24h');

    expect(labels[2]).toBe(formatDay(BERLIN_MIDNIGHT));
    expect(labels[3]).toBe('');
  });

  it('suppresses an hour label on the bar before the date', () => {
    // Midnight at index 4; index 3 is a stride position and sits right before it.
    const labels = axisLabels(hourlyBars(4), '24h');

    expect(labels[4]).toBe(formatDay(BERLIN_MIDNIGHT));
    expect(labels[3]).toBe('');
  });

  it('keeps 24H labels sparse enough to read', () => {
    const labels = axisLabels(chartSeries(series, '24h', SNAPSHOT_NOW), '24h');
    expect(labelled(labels).length).toBeLessThanOrEqual(10);
  });

  /**
   * 7D bars are six hours wide, so three of every four open no day. Labelling
   * those too would repeat each date four times and drift with the window.
   */
  it('labels only the day openings in 7D', () => {
    const points = chartSeries(series, '7d', SNAPSHOT_NOW);
    const labels = axisLabels(points, '7d');

    points.forEach((point, index) => {
      const opensDay = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        hour12: false,
        timeZone: 'Europe/Berlin',
      }).format(point.t);
      expect(labels[index] === '').toBe(opensDay !== '00');
    });
  });

  it('thins the 30D dates instead of printing all thirty', () => {
    const labels = axisLabels(chartSeries(series, '30d', SNAPSHOT_NOW), '30d');
    expect(labelled(labels).length).toBeLessThanOrEqual(10);
    expect(labelled(labels).length).toBeGreaterThan(4);
  });
});

describe('bucketSpanLabel', () => {
  it('names an hourly bar by its instant', () => {
    const points = chartSeries(series, '24h', SNAPSHOT_NOW);
    expect(bucketSpanLabel(points.at(-1)!, '24h')).toMatch(/^\d{2} \w{3} \d{2}:\d{2}$/);
  });

  /** A full day ends at midnight, which reads as 24:00 rather than 00:00. */
  it('closes a whole day at 24:00', () => {
    const points = chartSeries(series, '30d', SNAPSHOT_NOW);
    expect(bucketSpanLabel(points[1]!, '30d')).toMatch(/00:00–24:00$/);
  });

  /** The window's last day is still in progress and must not claim otherwise. */
  it('reports the closing partial day as the part-day it is', () => {
    const points = chartSeries(series, '30d', SNAPSHOT_NOW);
    expect(bucketSpanLabel(points.at(-1)!, '30d')).toMatch(/00:00–15:00$/);
  });

  /** The window opens mid-afternoon, so the first day starts where it starts. */
  it('reports the opening partial day from the hour the window opens', () => {
    const points = chartSeries(series, '30d', SNAPSHOT_NOW);
    expect(bucketSpanLabel(points[0]!, '30d')).toMatch(/15:00–24:00$/);
  });
});
