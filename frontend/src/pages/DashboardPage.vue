<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';

import PageHeader from '@/components/layout/PageHeader.vue';
import StateBlock from '@/components/ui/StateBlock.vue';
import DistrictWatchlist from '@/features/dashboard/DistrictWatchlist.vue';
import KpiRow from '@/features/dashboard/KpiRow.vue';
import SensorMap from '@/features/dashboard/SensorMap.vue';
import { useSelectionUrl } from '@/features/dashboard/useSelectionUrl';
import { matchesStation } from '@/domain/search';
import { useNetwork } from '@/queries/useNetwork';
import { useSelectionStore } from '@/stores/selection';
import { useWatchlistStore } from '@/stores/watchlist';

defineOptions({ name: 'DashboardPage' });

/**
 * The chart pulls in ECharts, which is the single largest dependency in the
 * app. Loading it asynchronously keeps it out of the dashboard's initial chunk
 * so the KPIs and the map — the part an operator reads first, and the part
 * above the fold — paint without waiting for a charting library. The card
 * renders its own loading state until the module arrives.
 */
const ConcentrationChart = defineAsyncComponent(
  () => import('@/features/dashboard/ConcentrationChart.vue'),
);

const query = ref('');
const selection = useSelectionStore();
// Station, range and pollutant live in the address bar, so a reload keeps them
// and the link can be sent to someone else.
useSelectionUrl();
const watchlist = useWatchlistStore();
const { view, isLoading, isError, refetch } = useNetwork();

/**
 * The header search narrows what the dashboard is showing rather than jumping
 * to a result: the map and the watchlist are both "the network right now", so
 * filtering them together answers "how is Pankow doing?" in one step. The
 * sensor list, where the same field filters a table, is the place for
 * exhaustive lookup.
 */
const visibleStations = computed(() =>
  view.value.stations.filter((station) => matchesStation(station, query.value)),
);

const trackedStations = computed(() => {
  const tracked = new Set(watchlist.ids);
  return visibleStations.value.filter((station) => tracked.has(station.id));
});

const noMatches = computed(
  () => !isLoading.value && query.value.trim() !== '' && visibleStations.value.length === 0,
);

const selectedStation = computed(() =>
  selection.stationId === null ? null : (view.value.stationsById.get(selection.stationId) ?? null),
);

/**
 * What the Districts panel lists: the tracked stations, and — first — whatever
 * is currently loaded into the chart when that station is not one of them.
 *
 * Selecting a marker used to update the chart far below the fold and leave the
 * panel showing four unrelated stations, so the map's answer appeared nowhere
 * near the map. The provisional row puts it where the eye already is, with a
 * hollow star: one tap turns "what I am looking at" into "what I track".
 */
const panelStations = computed(() => {
  const selected = selectedStation.value;
  const isVisible = selected !== null && visibleStations.value.some((s) => s.id === selected.id);
  if (selected === null || !isVisible || watchlist.has(selected.id)) return trackedStations.value;
  return [selected, ...trackedStations.value];
});

const selectedSeries = computed(() =>
  selection.stationId === null
    ? null
    : (view.value.seriesByStation.get(selection.stationId) ?? null),
);

// Seed the chart with something meaningful once data lands — the first tracked
// station, else the first in the network — and re-point it only when the
// current one drops out of view, never merely because it stopped being tracked.
watch(
  [trackedStations, visibleStations],
  ([tracked, visible]) => {
    if (visible.length === 0) return;
    const fallback = (tracked.length > 0 ? tracked : visible)[0]?.id ?? null;
    selection.ensureSelection(
      visible.map((station) => station.id),
      fallback,
    );
  },
  { immediate: true },
);
</script>

<template>
  <PageHeader v-model:query="query" title="Berlin · Particulate Monitoring" />

  <StateBlock
    v-if="isError"
    state="error"
    title="Could not load the sensor network"
    description="The dashboard reads from the mock API on port 8787. Start it with `npm run mock-api`, then try again."
    :on-retry="refetch"
  />

  <template v-else>
    <KpiRow :kpis="view.kpis" :reference="view.referenceKpis" :loading="isLoading" />

    <!-- The KPIs stay: they describe the whole network and are not filtered.
         What follows them is, so an empty result needs saying out loud rather
         than leaving a blank map. -->
    <p v-if="noMatches" class="dashboard__no-matches" role="status">
      No station matches “{{ query.trim() }}”. The map and watchlist below are empty until the
      search is cleared.
    </p>

    <div class="dashboard__split">
      <SensorMap
        v-model:pollutant="selection.pollutant"
        :stations="visibleStations"
        :metrics-by-station="view.metricsByStation"
        :selected-id="selection.stationId"
        @select="selection.select($event)"
      />
      <DistrictWatchlist
        :stations="panelStations"
        :metrics-by-station="view.metricsByStation"
        :selected-id="selection.stationId"
        :tracked-ids="watchlist.ids"
        :watchlist-full="watchlist.isFull"
        :loading="isLoading"
        :filtered="query.trim() !== ''"
        @select="selection.select($event)"
        @toggle="watchlist.toggle($event)"
      />
    </div>

    <ConcentrationChart
      v-model:range="selection.range"
      :station="selectedStation"
      :series="selectedSeries"
      :now="view.window?.now ?? null"
      :loading="isLoading"
    />
  </template>
</template>

<style scoped>
.dashboard__no-matches {
  padding: var(--aq-space-4) var(--aq-space-5);
  font-size: var(--aq-text-sm);
  color: var(--aq-ink-muted);
  background: var(--aq-surface);
  border: 1px solid var(--aq-border);
  border-radius: var(--aq-radius-lg);
}

.dashboard__split {
  display: grid;
  grid-template-columns: minmax(0, 1.9fr) minmax(340px, 1fr);
  gap: var(--aq-space-4);
  align-items: stretch;
}

/* iPad: the map and the watchlist each need the full width to stay legible —
   side by side at 768 px the map becomes a postage stamp. */
@media (width <= 1100px) {
  .dashboard__split {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
