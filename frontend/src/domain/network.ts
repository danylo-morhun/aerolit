import { computeKpis, type KpiSnapshot } from './kpi';
import { deriveStationMetrics } from './station-metrics';
import { HOUR_MS } from './time';
import type { ReadingSeries, StationMetrics } from './types';

/** How far back the KPI trend badges look. */
export const TREND_LOOKBACK_HOURS = 168;

export interface SnapshotWindow {
  /** The most recent hour anywhere in the dataset — the app's "now". */
  readonly now: number;
  /** The earliest hour anywhere in the dataset. */
  readonly dataStart: number;
}

/**
 * Locates the snapshot in time.
 *
 * The dataset is fixed, so "now" is a property of the data, not of the clock:
 * the latest hour *any* station reported. Taking the maximum across stations
 * rather than a single reference station matters because 17 of the 240 are
 * offline — anchoring on one of those would shift the whole app's notion of
 * now backwards and quietly mark the offline stations as healthy.
 */
export function snapshotWindow(seriesList: Iterable<ReadingSeries>): SnapshotWindow | null {
  let now = Number.NEGATIVE_INFINITY;
  let dataStart = Number.POSITIVE_INFINITY;

  for (const series of seriesList) {
    const first = series[0];
    const last = series[series.length - 1];
    if (first === undefined || last === undefined) continue;
    if (first.t < dataStart) dataStart = first.t;
    if (last.t > now) now = last.t;
  }

  return Number.isFinite(now) && Number.isFinite(dataStart) ? { now, dataStart } : null;
}

export interface NetworkInput {
  /** Station id → its readings. */
  readonly seriesByStation: ReadonlyMap<string, ReadingSeries>;
  readonly window: SnapshotWindow;
  /** Instant to evaluate at; defaults to the snapshot's "now". */
  readonly at?: number;
}

/** Per-station metrics for the whole network at one instant. */
export function deriveNetworkMetrics({
  seriesByStation,
  window,
  at = window.now,
}: NetworkInput): StationMetrics[] {
  const metrics: StationMetrics[] = [];
  for (const [stationId, series] of seriesByStation) {
    metrics.push(deriveStationMetrics({ stationId, series, at, dataStart: window.dataStart }));
  }
  return metrics;
}

export interface NetworkRollup {
  readonly metricsByStation: ReadonlyMap<string, StationMetrics>;
  readonly current: KpiSnapshot;
  /** KPIs recomputed 168 h earlier; `null` if that instant predates the data. */
  readonly reference: KpiSnapshot | null;
}

/**
 * The dashboard's whole derived state, in two passes over the series.
 *
 * The week-ago reference runs the *same* derivation at now − 168 h rather than
 * a separate approximation, which is what makes the trend badges a real
 * week-over-week delta instead of a decorative number.
 */
export function rollUpNetwork(input: NetworkInput): NetworkRollup {
  const currentMetrics = deriveNetworkMetrics(input);
  const metricsByStation = new Map(currentMetrics.map((m) => [m.stationId, m]));

  const referenceAt = input.window.now - TREND_LOOKBACK_HOURS * HOUR_MS;
  const hasHistory = referenceAt >= input.window.dataStart;

  return {
    metricsByStation,
    current: computeKpis(currentMetrics),
    reference: hasHistory ? computeKpis(deriveNetworkMetrics({ ...input, at: referenceAt })) : null,
  };
}
