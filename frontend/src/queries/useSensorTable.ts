import { useQueries, useQuery } from '@tanstack/vue-query';
import { computed, ref, watch, type Ref } from 'vue';

import { fetchReadings, fetchStationPage } from '@/api/stations';
import { snapshotWindow } from '@/domain/network';
import { matchesStation } from '@/domain/search';
import {
  isServerOrder,
  sortRows,
  type SortableRow,
  type SortDirection,
  type SortKey,
} from '@/domain/sort';
import { deriveStationMetrics } from '@/domain/station-metrics';
import type { ReadingSeries, Station } from '@/domain/types';

import { queryKeys } from './keys';
import { useNetwork, useStationCount } from './useNetwork';

export const PAGE_SIZE = 20;

/**
 * Columns whose values come from a station's readings.
 *
 * Ordering by one of these is the only question that cannot be answered without
 * every station's series — you cannot know which twenty stations have the
 * highest PM2.5 until you have looked at all 240. Everything else (a text
 * search, ordering by id, district or neighbourhood) is answered from the
 * lightweight identity index, and only the twenty rows on screen need readings.
 */
const MEASURED_KEYS: readonly SortKey[] = ['pm25', 'pm10', 'aqi', 'connection'];

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
  /**
   * How far into the collection the cursor walk has reached.
   *
   * The API has no offset access, and this does not invent one — it is a tally
   * of pages actually stepped through, which is enough to tell the operator
   * where they are ("page 2 of 12") even though there is no way to jump there.
   */
  const browseOffset = ref(0);

  const mode = computed<TableMode>(() =>
    query.value.trim() !== '' || !isServerOrder(sortKey.value, sortDirection.value)
      ? 'search'
      : 'browse',
  );

  /** Whether the current question needs every station's readings, not just the page's. */
  const needsNetworkReadings = computed(
    () => mode.value === 'search' && MEASURED_KEYS.includes(sortKey.value),
  );

  // ---------------------------------------------------------------- browse

  const stationCount = useStationCount();

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

  // ---------------------------------------------------------------- search

  /**
   * The station index, and — only when the sort demands it — every series.
   *
   * Both halves are shared with the dashboard's cache, so arriving here after
   * the dashboard has loaded costs nothing at all.
   */
  const network = useNetwork(
    computed(() => mode.value === 'search'),
    needsNetworkReadings,
  );

  const searchMatches = computed<readonly Station[]>(() =>
    network.view.value.stations.filter((station) => matchesStation(station, query.value)),
  );

  const searchTotal = computed(() => searchMatches.value.length);

  // ---------------------------------------------------------------- window

  /**
   * The rows this render will show, before their measured columns are attached.
   *
   * Browse takes the server's page as-is — the only ordering it serves is the
   * one it already returns. Search orders the matches and takes the current
   * window of twenty; when the ordering is by a measured column the metrics are
   * already in hand from the roll-up, otherwise the rows arrive bare and are
   * enriched below.
   */
  const windowRows = computed<SortableRow[]>(() => {
    if (mode.value === 'browse') {
      return (pageQuery.data.value?.items ?? []).map((station) => ({ station, metrics: null }));
    }

    const rows: SortableRow[] = searchMatches.value.map((station) => ({
      station,
      metrics: needsNetworkReadings.value
        ? (network.view.value.metricsByStation.get(station.id) ?? null)
        : null,
    }));

    return sortRows(rows, sortKey.value, sortDirection.value).slice(
      searchOffset.value,
      searchOffset.value + PAGE_SIZE,
    );
  });

  // ------------------------------------------------------------ enrichment

  /**
   * Readings for the rows on screen, one query each.
   *
   * Per-row queries rather than one bulk call so the cache is shared with the
   * dashboard: arriving here after the dashboard has loaded, every row is
   * already warm and the table renders without a request. Skipped entirely when
   * the roll-up has already produced the metrics.
   */
  const rowStations = computed<readonly Station[]>(() =>
    needsNetworkReadings.value ? [] : windowRows.value.map((row) => row.station),
  );

  const rowReadings = useQueries({
    queries: computed(() =>
      rowStations.value.map((station) => ({
        queryKey: queryKeys.readings(station.id),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          fetchReadings(station.id, undefined, { signal }),
      })),
    ),
  });

  const rowSeries = computed(() => {
    const map = new Map<string, ReadingSeries>();
    rowStations.value.forEach((station, index) => {
      const data = rowReadings.value[index]?.data;
      if (data) map.set(station.id, data);
    });
    return map;
  });

  /**
   * The snapshot instant, from the series currently loaded.
   *
   * On the dashboard this is exact — every station is present. Here it is the
   * latest hour among the visible rows, which lands on the true "now" unless
   * every one of them is offline (17 of 240 are, so a page of 20 all being
   * offline is vanishingly unlikely). Recorded in NOTES.md.
   */
  const rowWindow = computed(() => snapshotWindow(rowSeries.value.values()));

  const rows = computed<SortableRow[]>(() => {
    if (needsNetworkReadings.value) return windowRows.value;

    const window = rowWindow.value;
    return windowRows.value.map(({ station }) => {
      const series = rowSeries.value.get(station.id);
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

  // ---------------------------------------------------------------- status

  /**
   * Blocking load: there are no rows to show yet.
   *
   * Deliberately excludes the per-row readings. Station identity arrives first
   * and those rows are useful immediately; covering them with a spinner while
   * the measured columns stream in would hide content the operator can already
   * read, and would flicker the pagination controls disabled. A sort *by* a
   * measured column is the exception — showing rows in an order the data has
   * not confirmed yet would reshuffle them under the operator's eyes.
   */
  const isLoading = computed(() =>
    mode.value === 'browse' ? pageQuery.isPending.value : network.isLoading.value,
  );

  /** Non-blocking: rows are on screen, their measured columns still filling in. */
  const isEnriching = computed(
    () => !isLoading.value && rowReadings.value.some((query) => query.isPending),
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
      browseOffset.value += PAGE_SIZE;
    } else {
      searchOffset.value += PAGE_SIZE;
    }
  }

  function previous(): void {
    if (!canGoPrevious.value) return;
    if (mode.value === 'browse') {
      const before = pageQuery.data.value?.prevCursor;
      if (before) cursor.value = { before };
      browseOffset.value = Math.max(0, browseOffset.value - PAGE_SIZE);
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
    if (mode.value === 'browse') {
      cursor.value = {};
      browseOffset.value = 0;
    }
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
    /** Matches in search mode, the whole network in browse. */
    total: computed(() =>
      mode.value === 'search' ? searchTotal.value : (stationCount.data.value ?? null),
    ),
    /** 1-based index of the first row on screen, in whichever mode is active. */
    rangeStart: computed(() =>
      mode.value === 'search' ? searchOffset.value + 1 : browseOffset.value + 1,
    ),
    pageSize: PAGE_SIZE,
    refetch: () => (mode.value === 'browse' ? pageQuery.refetch() : network.refetch()),
  };
}
