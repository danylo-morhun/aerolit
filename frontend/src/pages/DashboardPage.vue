<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';

import PageHeader from '@/components/layout/PageHeader.vue';
import StateBlock from '@/components/ui/StateBlock.vue';
import DistrictWatchlist from '@/features/dashboard/DistrictWatchlist.vue';
import KpiRow from '@/features/dashboard/KpiRow.vue';
import SensorMap from '@/features/dashboard/SensorMap.vue';
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

const watchlistStations = computed(() => {
  const tracked = new Set(watchlist.ids);
  return visibleStations.value.filter((station) => tracked.has(station.id));
});

const selectedStation = computed(() =>
  selection.stationId === null ? null : (view.value.stationsById.get(selection.stationId) ?? null),
);

const selectedSeries = computed(() =>
  selection.stationId === null
    ? null
    : (view.value.seriesByStation.get(selection.stationId) ?? null),
);

// Seed the chart with something meaningful once data lands: the first tracked
// station, falling back to the first station in the network.
watch(
  [watchlistStations, () => view.value.stations],
  ([tracked, all]) => {
    const candidates = (tracked.length > 0 ? tracked : all).map((station) => station.id);
    if (candidates.length > 0) selection.ensureSelection(candidates);
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

    <div class="dashboard__split">
      <SensorMap
        v-model:pollutant="selection.pollutant"
        :stations="visibleStations"
        :metrics-by-station="view.metricsByStation"
        :selected-id="selection.stationId"
        @select="selection.select($event)"
      />
      <DistrictWatchlist
        :stations="watchlistStations"
        :metrics-by-station="view.metricsByStation"
        :selected-id="selection.stationId"
        :loading="isLoading"
        @select="selection.select($event)"
        @unwatch="watchlist.toggle($event)"
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
