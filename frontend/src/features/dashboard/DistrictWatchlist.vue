<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import AppCard from '@/components/ui/AppCard.vue';
import AqiBadge from '@/components/ui/AqiBadge.vue';
import ConnectionBadge from '@/components/ui/ConnectionBadge.vue';
import MetricChip from '@/components/ui/MetricChip.vue';
import Sparkline from '@/components/ui/Sparkline.vue';
import WatchStar from '@/components/ui/WatchStar.vue';
import StateBlock from '@/components/ui/StateBlock.vue';
import { formatConcentration } from '@/domain/format';
import type { Station, StationMetrics } from '@/domain/types';

const props = defineProps<{
  /** Tracked stations, plus the selected one when it is not tracked. */
  stations: readonly Station[];
  metricsByStation: ReadonlyMap<string, StationMetrics>;
  selectedId: string | null;
  /** Which of the rows are actually on the watchlist. */
  trackedIds: readonly string[];
  watchlistFull: boolean;
  loading?: boolean;
  /** True when a header search is narrowing the panel. */
  filtered?: boolean;
}>();

const emit = defineEmits<{
  select: [stationId: string];
  toggle: [stationId: string];
}>();

/**
 * Two different empty states: nothing tracked at all, versus tracked stations
 * that the current search hides. Telling an operator to go and star something
 * when they have simply filtered them out would be misleading.
 */
const emptyDescription = computed(() =>
  props.filtered
    ? 'No tracked station matches the current search.'
    : 'Star a station in the sensor list to follow it here.',
);

const rows = computed(() =>
  props.stations.map((station) => ({
    station,
    metrics: props.metricsByStation.get(station.id) ?? null,
    watched: props.trackedIds.includes(station.id),
  })),
);

/** True when the only row is the selected station, which is not tracked. */
const nothingTracked = computed(() => rows.value.every((row) => !row.watched));

const list = ref<HTMLElement | null>(null);

/**
 * Keeps the selected row visible when the selection came from somewhere else.
 *
 * The panel scrolls once enough stations are tracked, so a marker clicked on
 * the map could otherwise highlight a row that is out of view — the same
 * "where did it go?" the provisional row exists to answer.
 */
watch(
  () => props.selectedId,
  async (id) => {
    if (id === null) return;
    await nextTick();
    const row = list.value?.querySelector(`[data-station="${CSS.escape(id)}"]`);
    // Optional call, not just optional chaining: jsdom has no `scrollIntoView`,
    // and a rejected watcher there is a failure in the test output for
    // behaviour that is purely cosmetic.
    row?.scrollIntoView?.({ block: 'nearest' });
  },
);
</script>

<template>
  <AppCard title="Districts" subtitle="Tracked monitoring stations">
    <template #actions>
      <RouterLink class="watchlist__all" :to="{ name: 'sensors' }">View all</RouterLink>
    </template>

    <StateBlock v-if="loading" state="loading" compact />
    <StateBlock
      v-else-if="rows.length === 0"
      state="empty"
      title="No tracked stations"
      :description="emptyDescription"
      compact
    />

    <ul v-else ref="list" class="watchlist" aria-label="Tracked stations">
      <li
        v-for="{ station, metrics, watched } in rows"
        :key="station.id"
        :data-station="station.id"
        :class="[
          'watchlist__item',
          {
            'watchlist__item--selected': station.id === selectedId,
            'watchlist__item--provisional': !watched,
          },
        ]"
      >
        <!-- The row is the button: selecting a station is the row's whole
             purpose, and wrapping it makes the entire card a tap target on
             touch rather than a small link inside it. -->
        <button
          type="button"
          class="watchlist__button"
          :aria-current="station.id === selectedId ? 'true' : undefined"
          @click="emit('select', station.id)"
        >
          <span class="watchlist__district">
            {{ station.district }}
            <!-- Says why a row is here without a star on it, so the panel never
                 looks as though it silently started tracking something. -->
            <span v-if="!watched" class="watchlist__flag">Selected</span>
          </span>
          <span class="watchlist__id aq-mono">{{ station.id }} · {{ station.location }}</span>

          <span class="watchlist__reading">
            <span :class="['watchlist__value', `watchlist__value--${metrics?.aqi ?? 'none'}`]">
              {{ formatConcentration(metrics?.pm25 ?? null) }}
            </span>
            <span class="watchlist__unit">
              <span>µg/m³</span>
              <span>PM2.5</span>
            </span>
          </span>

          <span class="watchlist__spark">
            <Sparkline
              :values="metrics?.sparkline ?? []"
              :category="metrics?.aqi ?? null"
              :label="`${station.district} PM2.5, last 24 hours`"
            />
          </span>

          <span class="watchlist__tags">
            <AqiBadge :category="metrics?.aqi ?? null" size="sm" />
            <MetricChip label="PM10" :value="formatConcentration(metrics?.pm10 ?? null)" />
            <ConnectionBadge
              :state="metrics?.connection ?? 'offline'"
              :stability="metrics?.stability ?? 0"
            />
          </span>
        </button>

        <!-- Sits outside the row button: nesting one button inside another is
             invalid, and the star is a separate action from selecting. -->
        <WatchStar
          class="watchlist__star"
          :watched="watched"
          :disabled="!watched && watchlistFull"
          :station-label="`${station.district} ${station.id}`"
          @toggle="emit('toggle', station.id)"
        />
      </li>
    </ul>

    <p v-if="!loading && rows.length > 0 && nothingTracked" class="watchlist__hint">
      Nothing tracked yet — star a station to keep it in this panel.
    </p>
  </AppCard>
</template>

<style scoped>
.watchlist__all {
  font-size: var(--aq-text-sm);
  font-weight: 600;
  color: var(--aq-accent-text);
  text-decoration: none;
}

.watchlist__all:hover {
  text-decoration: underline;
}

.watchlist {
  display: grid;
  gap: var(--aq-space-3);
  padding: 0;
  margin: 0;
  list-style: none;
  /* Tracking eight stations must not decide the height of the dashboard: past
     roughly four rows the panel scrolls inside itself, so the map keeps its
     size and the chart stays where the operator left it. `contain` stops that
     scroll chaining into the page once the list bottoms out. */
  max-height: min(56vh, 560px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.watchlist__hint {
  padding-top: var(--aq-space-3);
  font-size: var(--aq-text-sm);
  color: var(--aq-ink-muted);
}

/* Between the tablet breakpoint and the desktop split, the panel spans the full
   width and a single column of rows would be mostly empty space. */
@media (700px <= width <= 1100px) {
  .watchlist {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.watchlist__item {
  position: relative;
  background: var(--aq-surface-sunken);
  border: 1px solid transparent;
  border-radius: var(--aq-radius-lg);
  transition: border-color var(--aq-transition);
}

.watchlist__item--selected {
  border-color: var(--aq-accent);
  background: var(--aq-surface);
}

/* A row that is only here because it is selected reads as pinned-in-passing:
   dashed, so the difference from a tracked row survives a greyscale print. */
.watchlist__item--provisional {
  border-style: dashed;
  border-color: var(--aq-border-strong);
}

.watchlist__item--provisional.watchlist__item--selected {
  border-color: var(--aq-accent);
}

.watchlist__button {
  display: grid;
  grid-template-areas:
    'district spark'
    'id       spark'
    'reading  spark'
    'tags     tags';
  grid-template-columns: minmax(0, 1fr) 110px;
  gap: 2px var(--aq-space-3);
  width: 100%;
  padding: var(--aq-space-4);
  text-align: left;
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: inherit;
}

.watchlist__district {
  display: flex;
  flex-wrap: wrap;
  grid-area: district;
  gap: var(--aq-space-2);
  align-items: baseline;
  padding-right: var(--aq-space-6);
  font-size: var(--aq-text-base);
  font-weight: 700;
}

.watchlist__flag {
  padding: 2px 8px;
  font-size: var(--aq-text-2xs);
  font-weight: 600;
  color: var(--aq-accent-text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--aq-status-elevated-bg);
  border-radius: var(--aq-radius-pill);
}

.watchlist__id {
  grid-area: id;
  color: var(--aq-ink-subtle);
}

.watchlist__reading {
  display: flex;
  grid-area: reading;
  gap: var(--aq-space-2);
  align-items: baseline;
  margin-top: var(--aq-space-2);
}

/* The figure carries the AQI colour, so a row reads at a glance without
   pairing the number with its badge. */
.watchlist__value {
  font-size: var(--aq-text-lg);
  font-weight: 700;
  line-height: 1;
  color: var(--aq-ink);
}

.watchlist__value--good {
  color: var(--aq-status-good-fg);
}

.watchlist__value--moderate {
  color: var(--aq-status-moderate-fg);
}

.watchlist__value--elevated {
  color: var(--aq-status-elevated-fg);
}

.watchlist__value--unhealthy {
  color: var(--aq-status-unhealthy-fg);
}

.watchlist__value--none {
  color: var(--aq-ink-subtle);
}

.watchlist__unit {
  display: flex;
  flex-direction: column;
  font-size: var(--aq-text-2xs);
  line-height: 1.25;
  color: var(--aq-ink-muted);
}

.watchlist__spark {
  display: flex;
  grid-area: spark;
  align-items: center;
  justify-content: flex-end;
}

.watchlist__tags {
  display: flex;
  flex-wrap: wrap;
  grid-area: tags;
  gap: var(--aq-space-2);
  align-items: center;
  margin-top: var(--aq-space-3);
}

.watchlist__star {
  position: absolute;
  top: var(--aq-space-3);
  right: var(--aq-space-3);
}
</style>
