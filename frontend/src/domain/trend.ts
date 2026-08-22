/**
 * How a change should read to an operator.
 *
 * `good` / `bad` rather than `up` / `down`, because the brief is explicit that
 * the badge colour reflects whether the movement is an improvement, not its
 * sign: PM2.5 falling and stability rising are both green.
 */
export type TrendTone = 'good' | 'bad' | 'flat';

/** Direction of the arrow glyph, independent of tone. */
export type TrendDirection = 'up' | 'down' | 'flat';

export interface Trend {
  readonly delta: number;
  readonly direction: TrendDirection;
  readonly tone: TrendTone;
}

/**
 * Movements smaller than this read as no change.
 *
 * Without a dead band, floating-point noise in the averaged KPIs would render
 * a coloured "improvement" badge for a delta of 1e-14.
 */
export const TREND_EPSILON = 0.05;

export function toTrend(delta: number, higherIsBetter: boolean): Trend {
  if (!Number.isFinite(delta) || Math.abs(delta) < TREND_EPSILON) {
    return { delta: 0, direction: 'flat', tone: 'flat' };
  }

  const rising = delta > 0;
  return {
    delta,
    direction: rising ? 'up' : 'down',
    tone: rising === higherIsBetter ? 'good' : 'bad',
  };
}
