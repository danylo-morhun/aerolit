import type { StationMetrics } from './types';

export type KpiId = 'activeSensors' | 'avgPm25' | 'poorConnections' | 'networkStability';

export interface KpiSnapshot {
  /** Stations that are not offline. */
  readonly activeSensors: number;
  /** Mean current PM2.5 across reporting stations, µg/m³; `null` if none. */
  readonly avgPm25: number | null;
  /** Stations reporting but below the HQ-link stability threshold. */
  readonly poorConnections: number;
  /** Mean stability across the whole network, 0–1. */
  readonly networkStability: number;
}

export interface KpiDefinition {
  readonly id: KpiId;
  readonly label: string;
  /** Whether a rising value is an improvement — drives the badge colour. */
  readonly higherIsBetter: boolean;
}

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  { id: 'activeSensors', label: 'Active Sensors', higherIsBetter: true },
  { id: 'avgPm25', label: 'Avg PM2.5', higherIsBetter: false },
  { id: 'poorConnections', label: 'Poor Connection', higherIsBetter: false },
  { id: 'networkStability', label: 'Network Stability', higherIsBetter: true },
];

/**
 * Rolls the per-station metrics up into the four dashboard KPIs.
 *
 * Two judgement calls the brief leaves open:
 *
 * - **Avg PM2.5 covers reporting stations only.** An offline station's last
 *   reading can be hours or days old; folding it into a "current" average
 *   would quietly mix stale air into a live number. Stations that are silent
 *   are already counted by the Active Sensors tile.
 * - **Network Stability covers every station**, including offline ones. It
 *   measures how dependable the network is at delivering data, and a sensor
 *   that stopped reporting is the strongest possible evidence of
 *   undependability — excluding it would make the fleet look better the more
 *   of it failed.
 */
export function computeKpis(metrics: readonly StationMetrics[]): KpiSnapshot {
  let activeSensors = 0;
  let poorConnections = 0;
  let stabilitySum = 0;
  let pm25Sum = 0;
  let pm25Count = 0;

  for (const metric of metrics) {
    stabilitySum += metric.stability;

    if (metric.connection !== 'offline') {
      activeSensors += 1;
      if (metric.connection === 'poor') poorConnections += 1;
      if (metric.pm25 !== null) {
        pm25Sum += metric.pm25;
        pm25Count += 1;
      }
    }
  }

  return {
    activeSensors,
    avgPm25: pm25Count === 0 ? null : pm25Sum / pm25Count,
    poorConnections,
    networkStability: metrics.length === 0 ? 0 : stabilitySum / metrics.length,
  };
}

/**
 * Week-over-week change per KPI, in the KPI's own unit.
 *
 * Percentages move in percentage points, not percent: stability going from
 * 86.0 % to 86.8 % is `+0.8`, matching the badges in the mockup. `null` when
 * either side is unavailable, so the UI can show the tile without inventing a
 * trend.
 */
export function kpiDeltas(
  current: KpiSnapshot,
  reference: KpiSnapshot | null,
): Readonly<Record<KpiId, number | null>> {
  if (reference === null) {
    return { activeSensors: null, avgPm25: null, poorConnections: null, networkStability: null };
  }

  return {
    activeSensors: current.activeSensors - reference.activeSensors,
    avgPm25:
      current.avgPm25 === null || reference.avgPm25 === null
        ? null
        : current.avgPm25 - reference.avgPm25,
    poorConnections: current.poorConnections - reference.poorConnections,
    networkStability: (current.networkStability - reference.networkStability) * 100,
  };
}
