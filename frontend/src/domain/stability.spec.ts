import { describe, expect, it } from 'vitest';

import { buildSeries, SNAPSHOT_NOW, SNAPSHOT_START } from '../../tests/factories';
import {
  connectionAt,
  countReadingsInWindow,
  hasReadingAtHour,
  HQ_LINK_THRESHOLD,
  stabilityAt,
  STABILITY_WINDOW_HOURS,
} from './stability';
import { HOUR_MS } from './time';

const base = { now: SNAPSHOT_NOW, dataStart: SNAPSHOT_START };

describe('stabilityAt', () => {
  it('scores a complete 30-day series as 100%', () => {
    const series = buildSeries({ hours: STABILITY_WINDOW_HOURS });
    expect(stabilityAt({ series, ...base })).toBe(1);
  });

  it('scores missing hours proportionally', () => {
    const series = buildSeries({
      hours: STABILITY_WINDOW_HOURS,
      missing: Array.from({ length: 72 }, (_, i) => i),
    });
    expect(stabilityAt({ series, ...base })).toBeCloseTo(648 / 720, 10);
  });

  it('ignores readings outside the window', () => {
    // Two extra days of older history must not inflate the 30-day score.
    const series = buildSeries({ hours: STABILITY_WINDOW_HOURS + 48 });
    expect(stabilityAt({ series, ...base })).toBe(1);
  });

  it('never exceeds 1 even if a station double-reports', () => {
    const series = buildSeries({ hours: STABILITY_WINDOW_HOURS });
    const doubled = [...series, ...series].sort((a, b) => a.t - b.t);
    expect(stabilityAt({ series: doubled, ...base })).toBe(1);
  });

  it('returns 0 for an empty series', () => {
    expect(stabilityAt({ series: [], ...base })).toBe(0);
  });

  describe('clamping to the start of available history', () => {
    // This is what keeps the week-over-week KPI badges honest: a 30-day window
    // anchored a week before the snapshot reaches 168 h past the first reading.
    const weekEarlier = SNAPSHOT_NOW - 168 * HOUR_MS;

    it('scores only the hours that could have been observed', () => {
      const series = buildSeries({ hours: STABILITY_WINDOW_HOURS });
      expect(stabilityAt({ series, now: weekEarlier, dataStart: SNAPSHOT_START })).toBe(1);
    });

    it('would otherwise invent a ~23-point improvement', () => {
      const series = buildSeries({ hours: STABILITY_WINDOW_HOURS });
      const unclamped = 552 / 720;
      const clamped = stabilityAt({ series, now: weekEarlier, dataStart: SNAPSHOT_START });
      expect(clamped - unclamped).toBeCloseTo(0.2333, 3);
    });
  });
});

describe('countReadingsInWindow', () => {
  const series = buildSeries({ hours: 5 });

  it('counts inclusively at both bounds', () => {
    expect(countReadingsInWindow(series, series[0]!.t, series[4]!.t)).toBe(5);
    expect(countReadingsInWindow(series, series[1]!.t, series[3]!.t)).toBe(3);
  });

  it('counts a single hour', () => {
    expect(countReadingsInWindow(series, series[2]!.t, series[2]!.t)).toBe(1);
  });

  it('returns 0 when the window misses the series entirely', () => {
    expect(countReadingsInWindow(series, series[4]!.t + HOUR_MS, series[4]!.t + 5 * HOUR_MS)).toBe(
      0,
    );
  });
});

describe('hasReadingAtHour', () => {
  it('is true when the exact hour is present', () => {
    const series = buildSeries({ hours: 10 });
    expect(hasReadingAtHour(series, SNAPSHOT_NOW)).toBe(true);
    expect(hasReadingAtHour(series, SNAPSHOT_NOW - 3 * HOUR_MS)).toBe(true);
  });

  it('is false when that hour was dropped', () => {
    const series = buildSeries({ hours: 10, missing: [7] });
    expect(hasReadingAtHour(series, SNAPSHOT_NOW - 2 * HOUR_MS)).toBe(false);
  });

  it('is false for an empty series or a future hour', () => {
    expect(hasReadingAtHour([], SNAPSHOT_NOW)).toBe(false);
    expect(hasReadingAtHour(buildSeries({ hours: 3 }), SNAPSHOT_NOW + HOUR_MS)).toBe(false);
  });
});

describe('connectionAt', () => {
  it('is offline when the most recent expected hour is missing', () => {
    const series = buildSeries({ hours: STABILITY_WINDOW_HOURS, missing: [719] });
    expect(connectionAt({ series, ...base })).toBe('offline');
  });

  it('stays offline even at otherwise perfect stability', () => {
    // The brief: offline "whatever the stability %".
    const series = buildSeries({ endingAt: SNAPSHOT_NOW - HOUR_MS, hours: 719 });
    const result = connectionAt({ series, ...base });
    expect(stabilityAt({ series, ...base })).toBeGreaterThan(HQ_LINK_THRESHOLD);
    expect(result).toBe('offline');
  });

  it('is a poor link below the threshold', () => {
    const missing = Array.from({ length: 150 }, (_, i) => i);
    const series = buildSeries({ hours: STABILITY_WINDOW_HOURS, missing });
    expect(stabilityAt({ series, ...base })).toBeLessThan(HQ_LINK_THRESHOLD);
    expect(connectionAt({ series, ...base })).toBe('poor');
  });

  it('is an HQ link exactly at the threshold', () => {
    // 86% counts as HQ: the brief says "86% or better".
    const missing = Array.from({ length: 720 - 620 }, (_, i) => i); // 620/720 ≈ 0.8611
    const series = buildSeries({ hours: STABILITY_WINDOW_HOURS, missing });
    expect(stabilityAt({ series, ...base })).toBeGreaterThanOrEqual(HQ_LINK_THRESHOLD);
    expect(connectionAt({ series, ...base })).toBe('hq');
  });
});
