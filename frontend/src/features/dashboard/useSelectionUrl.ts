import { watch } from 'vue';
import {
  onBeforeRouteLeave,
  useRoute,
  useRouter,
  type LocationQuery,
  type LocationQueryRaw,
} from 'vue-router';

import type { ChartRange, Pollutant } from '@/domain/types';
import { useSelectionStore } from '@/stores/selection';

/**
 * The dashboard's selection, mirrored in the address bar.
 *
 * Without this the three things an operator actually chooses — which station,
 * which range, which pollutant — live only in memory, so "look at Pankow over
 * 30 days" is a sentence rather than a link, and a reload drops back to the
 * first tracked station. The URL is the natural home for that state: it
 * survives a refresh, it can be sent to a colleague, and it costs no store.
 *
 * `replace`, not `push`: toggling a range is not a navigation, and stacking a
 * history entry per tap would make the back button walk through every fiddle
 * instead of leaving the page.
 */

/**
 * Listed rather than checked against `RANGE_HOURS` with `in`: that operator
 * also answers true for everything on `Object.prototype`, so `?range=toString`
 * passed validation, reached `windowStart` as a function and produced a `NaN`
 * window — an empty chart, written back into the address bar so a reload
 * reproduced it. Caught in review; the unit test only covered `'90d'`, which
 * `in` happens to reject.
 */
const RANGES: readonly ChartRange[] = ['24h', '7d', '30d'];

const POLLUTANTS: readonly Pollutant[] = ['pm25', 'pm10'];

export const SELECTION_QUERY_KEYS = ['station', 'range', 'pollutant'] as const;

/** Defaults are left out of the URL — a link should carry choices, not noise. */
export const DEFAULT_RANGE: ChartRange = '24h';
export const DEFAULT_POLLUTANT: Pollutant = 'pm25';

// `noUncheckedIndexedAccess` means an absent key reads as `undefined`, which
// the router's own query type does not include — so it is spelled out here.
function firstValue(value: LocationQuery[string] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

export interface SelectionFromQuery {
  readonly station: string | null;
  readonly range: ChartRange | null;
  readonly pollutant: Pollutant | null;
}

/**
 * Reads the selection out of a query, ignoring anything it does not recognise.
 *
 * A hand-edited or stale link is a normal thing to receive, so a bad value is
 * dropped rather than applied: an unknown range would otherwise reach the chart
 * as a key with no window behind it. An unknown *station* is allowed through —
 * it cannot be checked here, and the dashboard already replaces a selection
 * that is not in the network once the data lands.
 */
export function readSelectionQuery(query: LocationQuery): SelectionFromQuery {
  const station = firstValue(query['station'])?.trim();
  const range = firstValue(query['range']);
  const pollutant = firstValue(query['pollutant']);

  return {
    station: station ? station : null,
    range: range !== null && RANGES.includes(range as ChartRange) ? (range as ChartRange) : null,
    pollutant:
      pollutant !== null && POLLUTANTS.includes(pollutant as Pollutant)
        ? (pollutant as Pollutant)
        : null,
  };
}

export interface SelectionState {
  readonly stationId: string | null;
  readonly range: ChartRange;
  readonly pollutant: Pollutant;
}

/**
 * The query a selection should produce, preserving anything else already there.
 *
 * Returns `null` when the current query already says this, so the caller can
 * skip a navigation that would change nothing — a `replace` per keystroke of
 * derived state is how a router ends up fighting its own watchers.
 */
export function selectionQuery(
  state: SelectionState,
  current: LocationQuery,
): LocationQueryRaw | null {
  const next: LocationQueryRaw = { ...current };

  const set = (key: (typeof SELECTION_QUERY_KEYS)[number], value: string | null) => {
    if (value === null) delete next[key];
    else next[key] = value;
  };

  set('station', state.stationId);
  set('range', state.range === DEFAULT_RANGE ? null : state.range);
  set('pollutant', state.pollutant === DEFAULT_POLLUTANT ? null : state.pollutant);

  const same =
    SELECTION_QUERY_KEYS.every((key) => firstValue(current[key]) === (next[key] ?? null)) &&
    Object.keys(current).length === Object.keys(next).length;

  return same ? null : next;
}

/** Hydrates the selection store from the URL, then keeps the URL in step. */
export function useSelectionUrl(): void {
  const route = useRoute();
  const router = useRouter();
  const selection = useSelectionStore();

  const initial = readSelectionQuery(route.query);
  if (initial.station !== null) selection.select(initial.station);
  if (initial.range !== null) selection.range = initial.range;
  if (initial.pollutant !== null) selection.pollutant = initial.pollutant;

  /**
   * The dashboard settles its selection *after* its data arrives, which can be
   * seconds later — by which time the operator may already have tapped through
   * to the sensor list. A `replace` carrying only a query resolves against
   * whatever the current location is, so one landing mid-navigation cancels it
   * and drops the operator back on the dashboard. The leave guard runs before
   * the navigation completes, which is exactly the window that needs closing.
   *
   * Honest about its evidence: this was written after watching navigations get
   * cancelled under WebKit, and the cause of *those* turned out to be the dev
   * server failing a dynamic import — the suite now runs against the built
   * bundle and they stopped. Removing this guard no longer breaks a
   * behavioural test. The race it closes is still real (the `replace` has no
   * path of its own), it costs five lines, and the failure it prevents is
   * silent and infuriating, so it stays — but it is insurance, not a fix for
   * something currently observable, and no test pins it.
   */
  let leaving = false;
  onBeforeRouteLeave(() => {
    leaving = true;
  });

  watch(
    () => [selection.stationId, selection.range, selection.pollutant] as const,
    ([stationId, range, pollutant]) => {
      if (leaving) return;
      const query = selectionQuery({ stationId, range, pollutant }, route.query);
      if (query !== null) void router.replace({ query });
    },
  );
}
