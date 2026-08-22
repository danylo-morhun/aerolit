import { describe, expect, it } from 'vitest';

import {
  EM_DASH,
  formatConcentration,
  formatConcentrationPrecise,
  formatDateTime,
  formatDelta,
  formatHour,
  formatStability,
  formatPercentPrecise,
} from './format';

describe('concentrations', () => {
  it('rounds to whole µg/m³ for cells and rows', () => {
    expect(formatConcentration(53.4)).toBe('53');
    expect(formatConcentration(52.5)).toBe('53');
  });

  it('keeps a tenth for headline averages', () => {
    expect(formatConcentrationPrecise(28.94)).toBe('28.9');
    expect(formatConcentrationPrecise(29)).toBe('29.0');
  });

  it('renders a dash rather than a zero for missing data', () => {
    for (const format of [formatConcentration, formatConcentrationPrecise]) {
      expect(format(null)).toBe(EM_DASH);
      expect(format(Number.NaN)).toBe(EM_DASH);
    }
  });
});

describe('percentages', () => {
  it('formats a 0–1 share', () => {
    expect(formatStability(0.964)).toBe('96%');
    expect(formatPercentPrecise(0.868)).toBe('86.8');
    expect(formatStability(null)).toBe(EM_DASH);
  });

  // The badge prints this figure next to the connection state, which is decided
  // from the unrounded share: rounding 0.8556 up to "86%" would label a poor
  // link with the percentage the brief calls healthy.
  it('rounds stability down so it never contradicts the connection label', () => {
    expect(formatStability(0.8555555)).toBe('85%');
    expect(formatStability(0.86)).toBe('86%');
    expect(formatStability(0.9999)).toBe('99%');
    expect(formatStability(1)).toBe('100%');
  });
});

describe('formatDelta', () => {
  it('always carries an explicit sign', () => {
    expect(formatDelta(6, 0)).toBe('+6');
    expect(formatDelta(16, 0)).toBe('+16');
    expect(formatDelta(-2.4, 1)).toBe('−2.4');
    expect(formatDelta(0.8, 1)).toBe('+0.8');
  });

  it('drops the sign at exactly zero', () => {
    expect(formatDelta(0, 0)).toBe('0');
  });

  it('renders a dash when there is no comparison', () => {
    expect(formatDelta(null, 1)).toBe(EM_DASH);
  });
});

describe('timestamps', () => {
  // Pinned to Europe/Berlin so the axis reads in the network's local time and
  // renders identically on every machine, CI included.
  const noonUtc = Date.parse('2026-07-11T12:00:00Z');

  it('shows Berlin local time, not UTC', () => {
    expect(formatHour(noonUtc)).toBe('14:00'); // CEST, UTC+2
  });

  it('formats a full timestamp for tooltips', () => {
    expect(formatDateTime(noonUtc)).toBe('11 Jul 14:00');
  });

  it('handles the winter offset', () => {
    expect(formatHour(Date.parse('2026-01-11T12:00:00Z'))).toBe('13:00'); // CET, UTC+1
  });
});
