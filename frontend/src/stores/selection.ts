import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { ChartRange, Pollutant } from '@/domain/types';

/**
 * What the operator is currently looking at.
 *
 * This is the one piece of genuinely shared UI state on the dashboard: the
 * map, the watchlist and the chart all read and write the same selection, and
 * they are siblings rather than ancestor and descendant, so prop-drilling it
 * through the page would mean routing a value up and back down through a
 * component that has no interest in it.
 *
 * Server data deliberately does not live here — that belongs to the query
 * cache. This store holds only choices a person made.
 */
export const useSelectionStore = defineStore('selection', () => {
  const stationId = ref<string | null>(null);
  const pollutant = ref<Pollutant>('pm25');
  const range = ref<ChartRange>('24h');

  function select(id: string | null): void {
    stationId.value = id;
  }

  /**
   * Keeps the selection pointing at something the operator can actually see.
   *
   * `available` is what is on screen — a search can narrow the network until
   * the selected station is no longer part of it, and a chart showing a station
   * that has been filtered away is a lie. Anything else leaves the choice
   * alone: untracking the station you are looking at, for instance, must not
   * silently move the chart to a different one.
   */
  function ensureSelection(available: readonly string[], fallback: string | null): void {
    if (stationId.value !== null && available.includes(stationId.value)) return;
    stationId.value = fallback;
  }

  return { stationId, pollutant, range, select, ensureSelection };
});
