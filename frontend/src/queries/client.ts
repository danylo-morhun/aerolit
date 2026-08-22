import type { VueQueryPluginOptions } from '@tanstack/vue-query';

/**
 * Query defaults for a *fixed snapshot* dataset.
 *
 * The brief is explicit that the data never changes and must not be polled, so
 * the usual staleness machinery is turned off: anything fetched stays fresh for
 * the session. That is what makes the dashboard's access pattern affordable —
 * the map, the KPI roll-ups, the watchlist sparklines and the chart all read
 * the same per-station series, and only the first of those pays for it.
 *
 * If this API ever became live, this object is the one place that changes.
 */
export const vueQueryOptions: VueQueryPluginOptions = {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // One retry covers a flaky local port; more would just delay the
        // error state the UI is designed to show.
        retry: 1,
      },
    },
  },
};
