<script setup lang="ts">
import { computed } from 'vue';

import AppCard from '@/components/ui/AppCard.vue';
import AqiBadge from '@/components/ui/AqiBadge.vue';
import ConnectionBadge from '@/components/ui/ConnectionBadge.vue';
import MetricChip from '@/components/ui/MetricChip.vue';
import Sparkline from '@/components/ui/Sparkline.vue';
import StateBlock from '@/components/ui/StateBlock.vue';
import { formatConcentration } from '@/domain/format';
import type { Station, StationMetrics } from '@/domain/types';

const props = defineProps<{
  stations: readonly Station[];
  metricsByStation: ReadonlyMap<string, StationMetrics>;
  selectedId: string | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  select: [stationId: string];
  unwatch: [stationId: string];
}>();

const rows = computed(() =>
  props.stations.map((station) => ({
    station,
    metrics: props.metricsByStation.get(station.id) ?? null,
  })),
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
      description="Star a station in the sensor list to follow it here."
      compact
    />

    <ul v-else class="watchlist" aria-label="Tracked stations">
      <li
        v-for="{ station, metrics } in rows"
        :key="station.id"
        :class="['watchlist__item', { 'watchlist__item--selected': station.id === selectedId }]"
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
          <span class="watchlist__district">{{ station.district }}</span>
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
        <button
          type="button"
          class="watchlist__star"
          :aria-label="`Stop tracking ${station.district} ${station.id}`"
          @click="emit('unwatch', station.id)"
        >
          <i class="pi pi-star-fill" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </AppCard>
</template>

<style scoped>
.watchlist__all {
  font-size: var(--aq-text-sm);
  font-weight: 600;
  color: var(--aq-accent);
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
  grid-area: district;
  padding-right: var(--aq-space-6);
  font-size: var(--aq-text-base);
  font-weight: 700;
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
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  font-size: 13px;
  color: var(--aq-accent);
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--aq-radius-sm);
}

.watchlist__star:hover {
  background: var(--aq-surface-sunken);
}
</style>
