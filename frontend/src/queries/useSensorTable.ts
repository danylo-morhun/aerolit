import { useQueries, useQuery } from '@tanstack/vue-query';
import { computed, ref, watch, type Ref } from 'vue';

import { fetchReadings, fetchStationPage } from '@/api/stations';
import { snapshotWindow } from '@/domain/network';
import { matchesStation } from '@/domain/search';
import {
  SERVER_ORDERED_KEYS,
  sortRows,
  type SortableRow,
  type SortDirection,
  type SortKey,
} from '@/domain/sort';
import { deriveStationMetrics } from '@/domain/station-metrics';
import type { ReadingSeries, Station } from '@/domain/types';

import { queryKeys } from './keys';
import { useNetwork } from './useNetwork';

export const PAGE_SIZE = 20;

/**
 * How the table is currently reading the collection.
 *
 * - `browse` — one cursor page at a time, exactly as `/stations` intends.
 * - `search` — the whole network, held client-side so a filter or a sort by a
 *   measured column means what the operator expects.
 *
 * The mode is derived, not chosen: the table starts in `browse` and only
 * leaves it when the operator asks a question a single page cannot answer.
 * See docs/adr/0006 for why this is a mode switch rather than one behaviour.
 */
export type TableMode = 'browse' | 'search';

interface Cursor {
  after?: string;
  before?: string;
}

export function useSensorTable(query: Ref<string>) {
  const sortKey = ref<SortKey>('id');
  const sortDirection = ref<SortDirection>('asc');
  const cursor = ref<Cursor>({});
  const searchOffset = ref(0);

  const mode = computed<TableMode>(() =>
    query.value.trim() !== '' || !SERVER_ORDERED_KEYS.includes(sortKey.value) ? 'search' : 'browse',
  );

  // ---------------------------------------------------------------- browse

  const pageQuery = useQuery({
    queryKey: computed(() =>
      queryKeys.stationPage(
        cursor.value.after ?? cursor.value.before ?? null,
        cursor.value.before ? 'before' : 'after',
      ),
    ),
    enabled: computed(() => mode.value === 'browse'),
    queryFn: ({ signal }) => fetchStationPage({ limit: PAGE_SIZE, ...cursor.value }, { signal }),
  });

  const browseStations = computed<readonly Station[]>(() => pageQuery.data.value?.items ?? []);

  /**
   * Readings for the rows on screen, one query each.
   *
   * Per-row queries rather than one bulk call so the cache is shared with the
   * dashboard: arriving here after the dashboard has loaded, every row is
   * already warm and the table renders without a request. Rows scroll out of
   * relevance, not out of cache — the snapshot never changes.
   */
  const rowReadings = useQueries({
    queries: computed(() =>
      browseStations.value.map((station) => ({
        queryKey: queryKeys.readings(station.id),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          fetchReadings(station.id, undefined, { signal }),
      })),
    ),
  });

  const browseSeries = computed(() => {
    const map = new Map<string, ReadingSeries>();
    browseStations.value.forEach((station, index) => {
      const data = rowReadings.value[index]?.data;
      if (data) map.set(station.id, data);
    });
    return map;
  });

  /**
   * The snapshot instant, from the series currently loaded.
   *
   * On the dashboard this is exact — every station is present. Here it is the
   * latest hour among the visible page, which lands on the true "now" unless
   * every station on the page is offline (17 of 240 are, so a page of 20 all
   * being offline is vanishingly unlikely). Recorded in NOTES.md.
   */
  const browseWindow = computed(() => snapshotWindow(browseSeries.value.values()));

  const browseRows = computed<SortableRow[]>(() => {
    const window = browseWindow.value;
    return browseStations.value.map((station) => {
      const series = browseSeries.value.get(station.id);
      return {
        station,
        metrics:
          series && window
            ? deriveStationMetrics({
                stationId: station.id,
                series,
                at: window.now,
                dataStart: window.dataStart,
              })
            : null,
      };
    });
  });

  // ---------------------------------------------------------------- search

  const network = useNetwork(computed(() => mode.value === 'search'));

  const searchRows = computed<SortableRow[]>(() =>
    network.view.value.stations
      .filter((station) => matchesStation(station, query.value))
      .map((station) => ({
        station,
        metrics: network.view.value.metricsByStation.get(station.id) ?? null,
      })),
  );

  const searchTotal = computed(() => searchRows.value.length);

  // ---------------------------------------------------------------- shared

  const rows = computed(() => {
    if (mode.value === 'browse') {
      // A page-local sort by id is the server's own order, so this is a no-op
      // for the default view and a reversal for descending.
      return sortRows(browseRows.value, sortKey.value, sortDirection.value);
    }
    const sorted = sortRows(searchRows.value, sortKey.value, sortDirection.value);
    return sorted.slice(searchOffset.value, searchOffset.value + PAGE_SIZE);
  });

  /**
   * Blocking load: there are no rows to show yet.
   *
   * Deliberately excludes the per-row readings. Station identity arrives first
   * and those rows are useful immediately; covering them with a spinner while
   * the measured columns stream in would hide content the operator can already
   * read, and would flicker the pagination controls disabled.
   */
  const isLoading = computed(() =>
    mode.value === 'browse' ? pageQuery.isPending.value : network.isLoading.value,
  );

  /** Non-blocking: rows are on screen, their measured columns still filling in. */
  const isEnriching = computed(
    () => mode.value === 'browse' && rowReadings.value.some((query) => query.isPending),
  );

  const isError = computed(() =>
    mode.value === 'browse' ? pageQuery.isError.value : network.isError.value,
  );

  const canGoNext = computed(() =>
    mode.value === 'browse'
      ? pageQuery.data.value?.nextCursor !== undefined
      : searchOffset.value + PAGE_SIZE < searchTotal.value,
  );

  const canGoPrevious = computed(() =>
    mode.value === 'browse'
      ? pageQuery.data.value?.prevCursor !== undefined
      : searchOffset.value > 0,
  );

  function next(): void {
    if (!canGoNext.value) return;
    if (mode.value === 'browse') {
      const after = pageQuery.data.value?.nextCursor;
      if (after) cursor.value = { after };
    } else {
      searchOffset.value += PAGE_SIZE;
    }
  }

  function previous(): void {
    if (!canGoPrevious.value) return;
    if (mode.value === 'browse') {
      const before = pageQuery.data.value?.prevCursor;
      if (before) cursor.value = { before };
    } else {
      searchOffset.value = Math.max(0, searchOffset.value - PAGE_SIZE);
    }
  }

  function toggleSort(key: SortKey): void {
    if (sortKey.value === key) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey.value = key;
      sortDirection.value = 'asc';
    }
  }

  // Any change to what is being asked returns to the first page: staying on
  // page 4 of a different result set shows the operator an arbitrary window.
  watch([query, sortKey, sortDirection], () => {
    searchOffset.value = 0;
    if (mode.value === 'browse') cursor.value = {};
  });

  return {
    mode,
    rows,
    sortKey,
    sortDirection,
    toggleSort,
    isLoading,
    isEnriching,
    isError,
    canGoNext,
    canGoPrevious,
    next,
    previous,
    searchTotal,
    rangeStart: computed(() => (mode.value === 'search' ? searchOffset.value + 1 : null)),
    refetch: () => (mode.value === 'browse' ? pageQuery.refetch() : network.refetch()),
  };
}
