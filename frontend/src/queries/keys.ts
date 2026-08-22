/**
 * Every cache key in one place.
 *
 * The dashboard's bulk fetch seeds the same `readings(id)` keys that the chart
 * reads individually — that only works if both sides derive the key from here
 * rather than writing the array literal twice.
 */
export const queryKeys = {
  stationPage: (cursor: string | null, direction: 'after' | 'before') =>
    ['stations', 'page', direction, cursor] as const,
  allStations: () => ['stations', 'all'] as const,
  stationCount: () => ['stations', 'count'] as const,
  readings: (stationId: string) => ['readings', stationId] as const,
  networkReadings: () => ['readings', 'network'] as const,
} as const;
