import { describe, expect, it } from 'vitest';

import { bandRangeLabel, bandsFor, classify, PM10_BANDS, PM25_BANDS } from './aqi';

describe('classify', () => {
  it.each([
    [0, 'good'],
    [11.9, 'good'],
    [12, 'moderate'],
    [34.9, 'moderate'],
    [35, 'elevated'],
    [54.9, 'elevated'],
    [55, 'unhealthy'],
    [500, 'unhealthy'],
  ])('classifies PM2.5 %p as %s', (value, expected) => {
    expect(classify(value)).toBe(expected);
  });

  it('treats a band boundary as the start of the higher band', () => {
    // The brief writes the bands as "0–12" and "12–35", which overlap at 12.
    // Resolving them as [from, to) is the decision under test here.
    expect(classify(12)).toBe('moderate');
    expect(classify(35)).toBe('elevated');
    expect(classify(55)).toBe('unhealthy');
  });

  it('returns null for a missing or non-finite value', () => {
    // An offline station has no air quality; that is not the same as good air.
    expect(classify(null)).toBeNull();
    expect(classify(Number.NaN)).toBeNull();
    expect(classify(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('uses the doubled scale for PM10', () => {
    // Same number, different verdict per pollutant — which is the point of
    // not reusing one scale for both: 23.9 µg/m³ is unremarkable as PM10 but
    // already moderate as PM2.5.
    expect(classify(23.9, 'pm10')).toBe('good');
    expect(classify(23.9, 'pm25')).toBe('moderate');
    expect(classify(24, 'pm10')).toBe('moderate');
    expect(classify(30, 'pm10')).toBe('moderate');
    expect(classify(30, 'pm25')).toBe('moderate');
    expect(classify(70, 'pm10')).toBe('elevated');
    expect(classify(110, 'pm10')).toBe('unhealthy');
  });

  it('falls back to the lowest band for negative values', () => {
    expect(classify(-1)).toBe('good');
  });
});

describe('bands', () => {
  it('covers the scale without gaps', () => {
    for (const [index, band] of PM25_BANDS.entries()) {
      const next = PM25_BANDS[index + 1];
      if (next) expect(band.to).toBe(next.from);
    }
    expect(PM25_BANDS.at(-1)?.to).toBeNull();
  });

  it('exposes the right band set per pollutant', () => {
    expect(bandsFor('pm25')).toBe(PM25_BANDS);
    expect(bandsFor('pm10')).toBe(PM10_BANDS);
  });

  it('labels ranges the way the legend reads', () => {
    expect(bandRangeLabel(PM25_BANDS[0]!)).toBe('0–12');
    expect(bandRangeLabel(PM25_BANDS[3]!)).toBe('55+');
  });
});
