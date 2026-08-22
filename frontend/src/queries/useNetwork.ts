import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';

import { mapWithConcurrency } from '@/api/concurrency';
import { fetchReadings, fetchStationPage, MAX_PAGE_SIZE } from '@/api/stations';
import { rollUpNetwork, snapshotWindow, type SnapshotWindow } from '@/domain/network';
import type { Reading, ReadingSeries, Station, StationMetrics } from '@/domain/types';
import type { KpiSnapshot } from '@/domain/kpi';

import { queryKeys } from './keys';

/**
 * How many station-series requests are allowed in flight at once.
 * Above the browser's ~6 connections per host the extra requests just queue.
 */
const READING_CONCURRENCY = 8;

/**
 * Every station's identity.
 *
 * This walks all pages of `/stations`, which is exactly what §8 forbids for the
 * *table* — and is unavoidable here: the map plots one marker per station and
 * the KPIs are network-wide roll-ups, neither of which can be computed from a
 * 20-row window. The prohibition is about not turning a paginated collection
 * into a client-side list to page through; the dashboard genuinely needs the
 * whole network. Only identity is fetched here (id, district, location,
 * coordinates), which is small.
 */
export function useAllStations() {
  return useQuery({
    queryKey: queryKeys.allStations(),
    queryFn: async ({ signal }): Promise<Station[]> => {
      const stations: Station[] = [];
      let cursor: string | undefined;

      do {
        const page = await fetchStationPage({ limit: MAX_PAGE_SIZE, after: cursor }, { signal });
        stations.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);

      return stations;
    },
  });
}

/**
 * A 30-day series for every station, fetched through a bounded pool.
 *
 * Each series is also written into its own `readings(id)` cache entry, so the
 * chart, the watchlist and the table all read a station's history straight
 * from cache instead of re-requesting it. One fetch, four consumers.
 */
export function useNetworkReadings(stationIds: ComputedRef<readonly string[]>) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.networkReadings(),
    enabled: computed(() => stationIds.value.length > 0),
    queryFn: async ({ signal }): Promise<Map<string, ReadingSeries>> => {
      const ids = stationIds.value;

      const series = await mapWithConcurrency(ids, READING_CONCURRENCY, (id) =>
        fetchReadings(id, undefined, { signal }),
      );

      const byStation = new Map<string, ReadingSeries>();
      ids.forEach((id, index) => {
        const readings: Reading[] = series[index] ?? [];
        byStation.set(id, readings);
        queryClient.setQueryData(queryKeys.readings(id), readings);
      });

      return byStation;
    },
  });
}

export interface NetworkView {
  readonly stations: readonly Station[];
  readonly stationsById: ReadonlyMap<string, Station>;
  readonly seriesByStation: ReadonlyMap<string, ReadingSeries>;
  readonly metricsByStation: ReadonlyMap<string, StationMetrics>;
  readonly window: SnapshotWindow | null;
  readonly kpis: KpiSnapshot | null;
  readonly referenceKpis: KpiSnapshot | null;
}

/**
 * The dashboard's whole derived state.
 *
 * Everything here is `computed` rather than stored: the derived values are a
 * pure function of two cached queries, so keeping a copy in a store would only
 * create a second source of truth to keep in sync. The two roll-up passes over
 * 240 × 720 readings run once per data change, not per render.
 */
export function useNetwork() {
  const stationsQuery = useAllStations();
  const stationIds = computed(() => (stationsQuery.data.value ?? []).map((s) => s.id));
  const readingsQuery = useNetworkReadings(stationIds);

  const view = computed<NetworkView>(() => {
    const stations = stationsQuery.data.value ?? [];
    const seriesByStation = readingsQuery.data.value ?? new Map<string, ReadingSeries>();
    const window = seriesByStation.size > 0 ? snapshotWindow(seriesByStation.values()) : null;

    if (window === null) {
      return {
        stations,
        stationsById: new Map(stations.map((s) => [s.id, s])),
        seriesByStation,
        metricsByStation: new Map(),
        window: null,
        kpis: null,
        referenceKpis: null,
      };
    }

    const rollup = rollUpNetwork({ seriesByStation, window });

    return {
      stations,
      stationsById: new Map(stations.map((s) => [s.id, s])),
      seriesByStation,
      metricsByStation: rollup.metricsByStation,
      window,
      kpis: rollup.current,
      referenceKpis: rollup.reference,
    };
  });

  return {
    view,
    isLoading: computed(() => stationsQuery.isPending.value || readingsQuery.isPending.value),
    isError: computed(() => stationsQuery.isError.value || readingsQuery.isError.value),
    error: computed(() => stationsQuery.error.value ?? readingsQuery.error.value),
    refetch: async () => {
      await stationsQuery.refetch();
      await readingsQuery.refetch();
    },
  };
}
