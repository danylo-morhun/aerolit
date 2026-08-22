import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

export const WATCHLIST_STORAGE_KEY = 'aerolit:watchlist';

/**
 * Stations tracked out of the box.
 *
 * The brief calls the Districts panel "a short watchlist of tracked stations,
 * not the full network" but never says which — so it seeds with one station
 * from each of the first four districts, and the star control lets an operator
 * make it theirs. Picking arbitrary ids and calling it a default is the honest
 * reading; showing the first four by id would look like a truncated list.
 */
export const DEFAULT_WATCHLIST = [
  'BLN-0001', // Mitte · Alexanderplatz
  'BLN-0021', // Friedrichshain-Kreuzberg · Kottbusser Tor
  'BLN-0041', // Pankow · Schoenhauser Allee
  'BLN-0061', // Charlottenburg-Wilmersdorf · Ernst-Reuter-Platz
] as const;

/** Keeps the panel scannable; beyond this it stops being a watchlist. */
export const MAX_WATCHLIST = 8;

function readStored(): string[] | null {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null;
  } catch {
    // Corrupt or unavailable storage falls back to the default rather than
    // leaving the panel broken.
    return null;
  }
}

export const useWatchlistStore = defineStore('watchlist', () => {
  const ids = ref<string[]>(readStored() ?? [...DEFAULT_WATCHLIST]);

  const isFull = computed(() => ids.value.length >= MAX_WATCHLIST);

  function has(stationId: string): boolean {
    return ids.value.includes(stationId);
  }

  function toggle(stationId: string): void {
    const index = ids.value.indexOf(stationId);
    if (index >= 0) {
      ids.value.splice(index, 1);
      return;
    }
    if (!isFull.value) ids.value.push(stationId);
  }

  watch(
    ids,
    (value) => {
      try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(value));
      } catch {
        // Preference won't survive a reload; the session still works.
      }
    },
    { deep: true },
  );

  return { ids, isFull, has, toggle };
});
