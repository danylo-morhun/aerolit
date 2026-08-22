<script setup lang="ts">
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { computed, ref, watch } from 'vue';

import AppCard from '@/components/ui/AppCard.vue';
import SegmentedToggle from '@/components/ui/SegmentedToggle.vue';
import { bandRangeLabel, bandsFor, classify } from '@/domain/aqi';
import { formatConcentration } from '@/domain/format';
import type { AqiCategory, Pollutant, Station, StationMetrics } from '@/domain/types';
import { useThemeStore } from '@/stores/theme';

import { useLeafletMap } from './useLeafletMap';

const props = defineProps<{
  stations: readonly Station[];
  metricsByStation: ReadonlyMap<string, StationMetrics>;
  selectedId: string | null;
}>();

const emit = defineEmits<{ select: [stationId: string] }>();

const pollutant = defineModel<Pollutant>('pollutant', { required: true });

const theme = useThemeStore();
const container = ref<HTMLElement | null>(null);
const { map, fitTo } = useLeafletMap(
  container,
  computed(() => theme.isDark),
);

/**
 * Marker colours come from the primitive palette, not the `-fg` semantic
 * tokens: an AQI category means the same thing in both themes, and the mockup
 * keeps the marker hues identical light and dark. Only the basemap swaps.
 */
const CATEGORY_COLOUR: Record<AqiCategory, string> = {
  good: 'var(--aq-c-good)',
  moderate: 'var(--aq-c-moderate)',
  elevated: 'var(--aq-c-elevated)',
  unhealthy: 'var(--aq-c-unhealthy)',
};

const legend = computed(() =>
  bandsFor(pollutant.value).map((band) => ({
    label: band.label,
    range: bandRangeLabel(band),
    category: band.category,
  })),
);

let markerLayer: L.LayerGroup | null = null;

function categoryOf(stationId: string): AqiCategory | null {
  const metrics = props.metricsByStation.get(stationId);
  if (!metrics) return null;
  const value = pollutant.value === 'pm25' ? metrics.pm25 : metrics.pm10;
  return classify(value, pollutant.value);
}

function drawMarkers(): void {
  const instance = map.value;
  if (!instance) return;

  markerLayer?.remove();
  markerLayer = L.layerGroup().addTo(instance as L.Map);

  for (const station of props.stations) {
    const category = categoryOf(station.id);
    const metrics = props.metricsByStation.get(station.id);
    const selected = station.id === props.selectedId;

    const marker = L.circleMarker([station.coordinates.lat, station.coordinates.lng], {
      radius: selected ? 9 : 6,
      // `className` rather than inline colours, so the marker fill resolves
      // from the same CSS variables as the badges instead of a second palette.
      className: `marker marker--${category ?? 'none'}${selected ? ' marker--selected' : ''}`,
      weight: selected ? 3 : 1.5,
      fillOpacity: 1,
      // Keyboard users reach stations through the watchlist and the sensor
      // table; 240 tab stops on a map would be a worse experience than none.
      interactive: true,
      bubblingMouseEvents: false,
    });

    const value = pollutant.value === 'pm25' ? metrics?.pm25 : metrics?.pm10;
    marker.bindTooltip(
      `<strong>${station.district}</strong><br>${station.location} · ${station.id}<br>${pollutant.value === 'pm25' ? 'PM2.5' : 'PM10'} ${formatConcentration(value ?? null)} µg/m³`,
      { direction: 'top', offset: [0, -8], className: 'marker-tip' },
    );

    // Tap and click both fire `click` in Leaflet, so selection never depends
    // on hover — the tooltip is the enhancement, not the interaction.
    marker.on('click', () => emit('select', station.id));

    marker.addTo(markerLayer);
  }
}

watch(
  [map, () => props.stations, () => props.metricsByStation, () => props.selectedId, pollutant],
  drawMarkers,
  { immediate: true },
);

/**
 * Re-frame only when the *set* of stations changes — on load, and when the
 * header search narrows the network to a district. Refitting on a selection or
 * a pollutant switch would yank the viewport out from under an operator who
 * had panned somewhere deliberately.
 */
watch(
  [map, () => props.stations.map((station) => station.id).join(',')],
  () => fitTo(props.stations.map((station) => [station.coordinates.lat, station.coordinates.lng])),
  { immediate: true },
);
</script>

<template>
  <AppCard title="Sensor Map" subtitle="Particulate readings across Berlin" flush>
    <template #actions>
      <SegmentedToggle
        v-model="pollutant"
        group-label="Pollutant shown on the map"
        :options="[
          { value: 'pm25', label: 'PM2.5' },
          { value: 'pm10', label: 'PM10' },
        ]"
      />
    </template>

    <div class="map">
      <!-- `region`, not `application`: `application` hands keystrokes to the widget
           and traps a screen reader's virtual cursor, which would be a bad trade
           for a map whose stations are all reachable from the watchlist and the
           sensor table. -->
      <div
        ref="container"
        class="map__canvas"
        role="region"
        aria-label="Sensor map — station markers coloured by air quality index"
      />

      <div class="map__legend">
        <p class="map__legend-title">Air Quality Index</p>
        <ul class="map__legend-list" aria-label="Air Quality Index bands">
          <li v-for="band in legend" :key="band.category" class="map__legend-item">
            <span
              class="map__legend-dot"
              :style="{ background: CATEGORY_COLOUR[band.category] }"
              aria-hidden="true"
            />
            {{ band.label }} · {{ band.range }}
          </li>
        </ul>
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.map {
  position: relative;
  min-height: 420px;
  height: 100%;
}

.map__canvas {
  height: 100%;
  min-height: 420px;
  background: var(--aq-surface-sunken);
}

.map__legend {
  position: absolute;
  bottom: var(--aq-space-4);
  left: var(--aq-space-4);
  z-index: 500;
  padding: var(--aq-space-3) var(--aq-space-4);
  background: color-mix(in srgb, var(--aq-surface) 92%, transparent);
  border: 1px solid var(--aq-border);
  border-radius: var(--aq-radius-md);
  box-shadow: var(--aq-shadow-card);
}

.map__legend-title {
  margin-bottom: var(--aq-space-2);
  font-size: var(--aq-text-2xs);
  font-weight: 600;
  color: var(--aq-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.map__legend-list {
  display: grid;
  gap: 5px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.map__legend-item {
  display: flex;
  gap: var(--aq-space-2);
  align-items: center;
  font-size: var(--aq-text-xs);
  white-space: nowrap;
}

.map__legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

@media (width <= 900px) {
  .map,
  .map__canvas {
    min-height: 340px;
  }
}
</style>

<style>
/* Unscoped: Leaflet renders markers and tooltips outside the component's DOM
   subtree, so scoped attributes never reach them. Everything here is
   namespaced under Leaflet's own classes to keep the blast radius small. */
.marker {
  stroke: var(--aq-surface);
  transition: none;
}

.marker--good {
  fill: var(--aq-c-good);
}

.marker--moderate {
  fill: var(--aq-c-moderate);
}

.marker--elevated {
  fill: var(--aq-c-elevated);
}

.marker--unhealthy {
  fill: var(--aq-c-unhealthy);
}

.marker--none {
  fill: var(--aq-ink-subtle);
}

.marker--selected {
  stroke: var(--aq-accent);
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--aq-accent) 60%, transparent));
}

.leaflet-container {
  font-family: var(--aq-font-sans);
  background: var(--aq-surface-sunken);
}

.leaflet-tooltip.marker-tip {
  padding: 8px 10px;
  font-size: var(--aq-text-xs);
  line-height: 1.45;
  color: var(--aq-ink);
  background: var(--aq-surface);
  border: 1px solid var(--aq-border);
  border-radius: var(--aq-radius-sm);
  box-shadow: var(--aq-shadow-pop);
}

.leaflet-tooltip.marker-tip::before {
  border-top-color: var(--aq-border);
}

.leaflet-control-zoom a {
  color: var(--aq-ink);
  background: var(--aq-surface);
  border-color: var(--aq-border);
}

.leaflet-control-zoom a:hover {
  background: var(--aq-surface-sunken);
}

.leaflet-control-attribution {
  font-size: 10px;
  color: var(--aq-ink-muted);
  background: color-mix(in srgb, var(--aq-surface) 85%, transparent);
}

.leaflet-control-attribution a {
  color: var(--aq-ink-muted);
}
</style>
