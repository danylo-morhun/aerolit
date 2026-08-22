import type { AqiCategory, ConnectionState, Station, StationMetrics } from './types';

export type SortKey = 'id' | 'district' | 'location' | 'pm25' | 'pm10' | 'aqi' | 'connection';
export type SortDirection = 'asc' | 'desc';

export interface SortableRow {
  readonly station: Station;
  readonly metrics: StationMetrics | null;
}

/**
 * Columns the server can order by.
 *
 * `/stations` returns stations sorted by id and offers no sort parameter, so
 * this is the only ordering that survives cursor pagination. Sorting by
 * anything else means holding the rows being sorted — which is why the table
 * changes mode rather than pretending a page-local sort is a network-wide one.
 */
export const SERVER_ORDERED_KEYS: readonly SortKey[] = ['id'];

/** Worst-last, so ascending reads "healthiest first". */
const AQI_RANK: Record<AqiCategory, number> = {
  good: 0,
  moderate: 1,
  elevated: 2,
  unhealthy: 3,
};

const CONNECTION_RANK: Record<ConnectionState, number> = {
  hq: 0,
  poor: 1,
  offline: 2,
};

/**
 * Missing values sort last in both directions.
 *
 * A station with no reading is not "the lowest PM2.5" — treating it as 0 would
 * put broken sensors at the top of a "cleanest air" sort, which is exactly
 * backwards for an operator looking for problems.
 */
function compareNullable(a: number | null, b: number | null, direction: SortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

function valueOf(row: SortableRow, key: SortKey): number | null {
  switch (key) {
    case 'pm25':
      return row.metrics?.pm25 ?? null;
    case 'pm10':
      return row.metrics?.pm10 ?? null;
    case 'aqi':
      return row.metrics?.aqi ? AQI_RANK[row.metrics.aqi] : null;
    case 'connection':
      return row.metrics ? CONNECTION_RANK[row.metrics.connection] : null;
    default:
      return null;
  }
}

/**
 * Comparator for one column, with id as the tiebreak.
 *
 * The tiebreak matters more than it looks: without it, two stations with the
 * same PM2.5 can swap places between renders as the underlying array order
 * changes, and rows appear to shuffle on their own.
 */
export function compareRows(
  a: SortableRow,
  b: SortableRow,
  key: SortKey,
  direction: SortDirection,
): number {
  const factor = direction === 'asc' ? 1 : -1;

  let result: number;
  switch (key) {
    case 'id':
      result = a.station.id.localeCompare(b.station.id) * factor;
      break;
    case 'district':
      result = a.station.district.localeCompare(b.station.district) * factor;
      break;
    case 'location':
      result = a.station.location.localeCompare(b.station.location) * factor;
      break;
    default:
      result = compareNullable(valueOf(a, key), valueOf(b, key), direction);
  }

  return result !== 0 ? result : a.station.id.localeCompare(b.station.id);
}

export function sortRows(
  rows: readonly SortableRow[],
  key: SortKey,
  direction: SortDirection,
): SortableRow[] {
  return [...rows].sort((a, b) => compareRows(a, b, key, direction));
}
