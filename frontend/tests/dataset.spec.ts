import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ReadingDto } from '@/api/types';
import { kpiDeltas } from '@/domain/kpi';
import { rollUpNetwork, snapshotWindow, TREND_LOOKBACK_HOURS } from '@/domain/network';
import { HQ_LINK_THRESHOLD } from '@/domain/stability';
import { HOUR_MS } from '@/domain/time';
import type { Reading, ReadingSeries } from '@/domain/types';

/**
 * The domain layer against the real shipped dataset.
 *
 * The unit tests elsewhere use synthetic fixtures, which prove the functions do
 * what they say — but not that "what they say" matches the data. These numbers
 * were derived independently (a throwaway Python pass over `mock-data/`) and
 * pinned here, so a change in a definition — the stability window, the offline
 * rule, which stations feed the average — shows up as a failing expectation
 * rather than a plausible-looking dashboard.
 */

const READINGS_DIR = join(import.meta.dirname, '../mock-data/readings');

function loadNetwork(): Map<string, ReadingSeries> {
  const byStation = new Map<string, ReadingSeries>();
  for (const file of readdirSync(READINGS_DIR).filter((name) => name.endsWith('.json'))) {
    const dto = JSON.parse(readFileSync(join(READINGS_DIR, file), 'utf8')) as ReadingDto[];
    const series: Reading[] = dto.map((r) => ({ t: Date.parse(r.t), pm25: r.pm25, pm10: r.pm10 }));
    byStation.set(file.replace(/\.json$/, ''), series);
  }
  return byStation;
}

const seriesByStation = loadNetwork();
const window = snapshotWindow(seriesByStation.values());

describe('the shipped dataset', () => {
  it('holds 240 stations', () => {
    expect(seriesByStation.size).toBe(240);
  });

  it('spans exactly 30 days of hourly slots', () => {
    expect(window).not.toBeNull();
    expect(new Date(window!.now).toISOString()).toBe('2026-07-11T12:00:00.000Z');
    expect(new Date(window!.dataStart).toISOString()).toBe('2026-06-11T13:00:00.000Z');
    expect((window!.now - window!.dataStart) / HOUR_MS + 1).toBe(720);
  });

  it('is ordered oldest-first, on the hour', () => {
    for (const series of seriesByStation.values()) {
      for (let i = 1; i < series.length; i += 1) {
        expect(series[i]!.t).toBeGreaterThan(series[i - 1]!.t);
        expect(series[i]!.t % HOUR_MS).toBe(0);
      }
    }
  });
});

describe('network roll-up on real data', () => {
  const rollup = rollUpNetwork({ seriesByStation, window: window! });

  it('classifies every station', () => {
    expect(rollup.metricsByStation.size).toBe(240);
  });

  it('finds the 17 stations that missed the latest hour', () => {
    const offline = [...rollup.metricsByStation.values()].filter((m) => m.connection === 'offline');
    expect(offline).toHaveLength(17);
    expect(rollup.current.activeSensors).toBe(223);
  });

  it('matches the independently computed KPI values', () => {
    expect(rollup.current.avgPm25).toBeCloseTo(12.4413, 3);
    expect(rollup.current.poorConnections).toBe(17);
    expect(rollup.current.networkStability).toBeCloseTo(0.9461, 4);
  });

  it('agrees with the connection thresholds it reports', () => {
    for (const metric of rollup.metricsByStation.values()) {
      if (metric.connection === 'hq') {
        expect(metric.stability).toBeGreaterThanOrEqual(HQ_LINK_THRESHOLD);
      }
      if (metric.connection === 'poor') {
        expect(metric.stability).toBeLessThan(HQ_LINK_THRESHOLD);
      }
      expect(metric.stability).toBeGreaterThanOrEqual(0);
      expect(metric.stability).toBeLessThanOrEqual(1);
    }
  });
});

describe('week-over-week reference', () => {
  const rollup = rollUpNetwork({ seriesByStation, window: window! });

  it('produces a real delta, not a placeholder', () => {
    const deltas = kpiDeltas(rollup.current, rollup.reference);
    expect(deltas.activeSensors).toBe(-6);
    expect(deltas.poorConnections).toBe(-14);
    expect(deltas.avgPm25).toBeCloseTo(0.3426, 3);
    expect(deltas.networkStability).toBeCloseTo(0.0225, 3);
  });

  it('clamps the reference window to available history', () => {
    // A 30-day window anchored a week back reaches 168 h before the first
    // reading. Scoring against the full 720 hours regardless would put network
    // stability at ~0.725 a week ago and invent a +22-point recovery.
    const referenceStability = rollup.reference!.networkStability;
    const unclamped = referenceStability * (552 / 720);

    expect(referenceStability).toBeCloseTo(0.9459, 3);
    expect((rollup.current.networkStability - unclamped) * 100).toBeGreaterThan(20);
  });

  it('anchors the reference exactly 168 hours back', () => {
    expect(TREND_LOOKBACK_HOURS).toBe(168);
    expect(window!.now - TREND_LOOKBACK_HOURS * HOUR_MS).toBeGreaterThan(window!.dataStart);
  });
});
