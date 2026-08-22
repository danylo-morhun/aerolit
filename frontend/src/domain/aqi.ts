import type { AqiCategory, Pollutant } from './types';

export interface AqiBand {
  readonly category: AqiCategory;
  readonly label: string;
  /** Inclusive lower bound, µg/m³. */
  readonly from: number;
  /** Exclusive upper bound; `null` for the open-ended top band. */
  readonly to: number | null;
}

/**
 * The Air Quality Index bands given in the brief, for PM2.5.
 *
 * Bounds are treated as `[from, to)`, so the brief's "Good · 0–12" and
 * "Moderate · 12–35" don't overlap at 12: a reading of exactly 12 is Moderate.
 * The brief's ranges are ambiguous there; this is the conventional reading and
 * the one the legend copy implies.
 */
export const PM25_BANDS: readonly AqiBand[] = [
  { category: 'good', label: 'Good', from: 0, to: 12 },
  { category: 'moderate', label: 'Moderate', from: 12, to: 35 },
  { category: 'elevated', label: 'Elevated', from: 35, to: 55 },
  { category: 'unhealthy', label: 'Unhealthy', from: 55, to: null },
];

/**
 * PM10 bands.
 *
 * The brief defines one AQI scale and ties it to PM2.5, but the map has a PM10
 * mode that still needs to colour its markers. PM10 is measured on a coarser
 * scale — EU limit values put the PM10 daily limit at roughly twice the PM2.5
 * figure — so the PM2.5 bounds are doubled rather than reused as-is, which
 * would paint almost the whole network red. Recorded as an assumption in
 * NOTES.md; a real deployment would take these from the regulator.
 */
export const PM10_BANDS: readonly AqiBand[] = PM25_BANDS.map((band) => ({
  ...band,
  from: band.from * 2,
  to: band.to === null ? null : band.to * 2,
}));

export function bandsFor(pollutant: Pollutant): readonly AqiBand[] {
  return pollutant === 'pm25' ? PM25_BANDS : PM10_BANDS;
}

/**
 * Classifies a concentration into its AQI category.
 *
 * Returns `null` for a missing value so callers must decide how to render "no
 * data" — an offline station has no air quality, which is different from good
 * air quality.
 */
export function classify(value: number | null, pollutant: Pollutant = 'pm25'): AqiCategory | null {
  if (value === null || !Number.isFinite(value)) return null;

  const bands = bandsFor(pollutant);
  for (const band of bands) {
    if (value >= band.from && (band.to === null || value < band.to)) return band.category;
  }
  // Only reachable for negative values, which the sensors never report.
  return bands[0]?.category ?? null;
}

export const AQI_LABELS: Readonly<Record<AqiCategory, string>> = {
  good: 'Good',
  moderate: 'Moderate',
  elevated: 'Elevated',
  unhealthy: 'Unhealthy',
};

/** Formats a band for the map legend, e.g. "0–12" or "55+". */
export function bandRangeLabel(band: AqiBand): string {
  return band.to === null ? `${band.from}+` : `${band.from}–${band.to}`;
}
