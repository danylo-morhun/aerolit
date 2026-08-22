import { describe, expect, it } from 'vitest';

import { toTrend, TREND_EPSILON } from './trend';

describe('toTrend', () => {
  it('reads a rise as good when higher is better', () => {
    expect(toTrend(6, true)).toMatchObject({ direction: 'up', tone: 'good' });
  });

  it('reads a rise as bad when lower is better', () => {
    // More poor connections is a regression even though the number went up.
    expect(toTrend(16, false)).toMatchObject({ direction: 'up', tone: 'bad' });
  });

  it('reads a fall in PM2.5 as an improvement', () => {
    expect(toTrend(-2.4, false)).toMatchObject({ direction: 'down', tone: 'good' });
  });

  it('reads a fall in stability as a regression', () => {
    expect(toTrend(-0.8, true)).toMatchObject({ direction: 'down', tone: 'bad' });
  });

  it('treats sub-threshold movement as flat', () => {
    // Averaged KPIs produce floating-point noise; without a dead band a
    // 1e-14 delta would render as a coloured improvement.
    expect(toTrend(1e-14, true)).toEqual({ delta: 0, direction: 'flat', tone: 'flat' });
    expect(toTrend(TREND_EPSILON / 2, false).tone).toBe('flat');
    expect(toTrend(0, true).tone).toBe('flat');
  });

  it('treats a non-finite delta as flat rather than throwing', () => {
    expect(toTrend(Number.NaN, true).tone).toBe('flat');
  });
});
