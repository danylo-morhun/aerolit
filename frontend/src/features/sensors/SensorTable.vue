<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';

import AqiBadge from '@/components/ui/AqiBadge.vue';
import ConnectionBadge from '@/components/ui/ConnectionBadge.vue';
import StateBlock from '@/components/ui/StateBlock.vue';
import { formatConcentration } from '@/domain/format';
import type { SortableRow, SortDirection, SortKey } from '@/domain/sort';
import type { AqiCategory } from '@/domain/types';
import type { TableMode } from '@/queries/useSensorTable';

defineProps<{
  rows: readonly SortableRow[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  mode: TableMode;
  loading: boolean;
  error: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  /** Present in search mode: total matches and the current window's first row. */
  total: number | null;
  rangeStart: number | null;
}>();

const emit = defineEmits<{
  sort: [key: SortKey];
  next: [];
  previous: [];
  retry: [];
}>();

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'id', label: 'ID' },
  { key: 'district', label: 'District' },
  { key: 'location', label: 'Neighborhood' },
  { key: 'pm25', label: 'PM2.5', numeric: true },
  { key: 'pm10', label: 'PM10', numeric: true },
  { key: 'aqi', label: 'AQI' },
  { key: 'connection', label: 'Connection' },
];

/** Ascending is the "healthiest first" direction, so it reads as up. */
function sortIcon(key: SortKey, activeKey: SortKey, direction: SortDirection): string {
  if (key !== activeKey) return 'pi pi-sort-alt';
  return direction === 'asc' ? 'pi pi-sort-up-fill' : 'pi pi-sort-down-fill';
}

function ariaSort(key: SortKey, activeKey: SortKey, direction: SortDirection) {
  if (key !== activeKey) return 'none';
  return direction === 'asc' ? 'ascending' : 'descending';
}

function pmClass(category: AqiCategory | null | undefined): string {
  return `cell-value cell-value--${category ?? 'none'}`;
}
</script>

<template>
  <div class="table">
    <StateBlock
      v-if="error"
      state="error"
      title="Could not load stations"
      description="The sensor list reads from the mock API on port 8787."
      :on-retry="() => emit('retry')"
    />

    <template v-else>
      <DataTable
        :value="[...rows]"
        data-key="station.id"
        :loading="loading"
        scrollable
        class="table__grid"
      >
        <Column v-for="column in COLUMNS" :key="column.key" :field="column.key">
          <template #header>
            <!--
              The sort control is a real button rather than DataTable's built-in
              sorting: ordering is decided in `useSensorTable`, because outside
              `browse` mode it has to apply to the whole result set and not just
              the twenty rows this component was handed.
            -->
            <button
              type="button"
              class="table__sort"
              :class="{ 'table__sort--numeric': column.numeric }"
              :aria-sort="ariaSort(column.key, sortKey, sortDirection)"
              @click="emit('sort', column.key)"
            >
              {{ column.label }}
              <i
                :class="[sortIcon(column.key, sortKey, sortDirection), 'table__sort-icon']"
                aria-hidden="true"
              />
            </button>
          </template>

          <template #body="{ data }: { data: SortableRow }">
            <template v-if="column.key === 'id'">
              <span class="aq-mono">{{ data.station.id }}</span>
            </template>
            <template v-else-if="column.key === 'district'">{{ data.station.district }}</template>
            <template v-else-if="column.key === 'location'">{{ data.station.location }}</template>
            <template v-else-if="column.key === 'pm25'">
              <span :class="pmClass(data.metrics?.aqi)">
                {{ formatConcentration(data.metrics?.pm25 ?? null) }}
              </span>
            </template>
            <template v-else-if="column.key === 'pm10'">
              {{ formatConcentration(data.metrics?.pm10 ?? null) }}
            </template>
            <template v-else-if="column.key === 'aqi'">
              <AqiBadge :category="data.metrics?.aqi ?? null" size="sm" />
            </template>
            <template v-else>
              <ConnectionBadge
                :state="data.metrics?.connection ?? 'offline'"
                :stability="data.metrics?.stability ?? 0"
              />
            </template>
          </template>
        </Column>

        <template #empty>
          <StateBlock
            :state="loading ? 'loading' : 'empty'"
            :title="loading ? 'Loading stations…' : 'No stations match that search'"
            compact
          />
        </template>
      </DataTable>

      <footer class="table__footer">
        <p class="table__status" aria-live="polite">
          <template v-if="mode === 'search' && total !== null">
            {{ total }} matching {{ total === 1 ? 'station' : 'stations' }}
            <span v-if="rangeStart !== null && total > 0">
              · showing {{ rangeStart }}–{{ Math.min(rangeStart + rows.length - 1, total) }}
            </span>
          </template>
          <template v-else> Browsing the network one page at a time </template>
        </p>

        <div class="table__pager">
          <Button
            label="Previous"
            icon="pi pi-angle-left"
            size="small"
            severity="secondary"
            outlined
            :disabled="!canGoPrevious || loading"
            @click="emit('previous')"
          />
          <Button
            label="Next"
            icon="pi pi-angle-right"
            icon-pos="right"
            size="small"
            severity="secondary"
            outlined
            :disabled="!canGoNext || loading"
            @click="emit('next')"
          />
        </div>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.table {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--aq-surface);
  border: 1px solid var(--aq-border);
  border-radius: var(--aq-radius-xl);
  box-shadow: var(--aq-shadow-card);
}

.table__grid {
  min-width: 0;
}

.table__sort {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 0;
  font-size: var(--aq-text-2xs);
  font-weight: 600;
  color: var(--aq-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  background: none;
  border: 0;
}

.table__sort:hover {
  color: var(--aq-ink);
}

.table__sort-icon {
  font-size: 9px;
  opacity: 0.7;
}

.table__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aq-space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--aq-space-4) var(--aq-space-5);
  border-top: 1px solid var(--aq-border);
}

.table__status {
  font-size: var(--aq-text-sm);
  color: var(--aq-ink-muted);
}

.table__pager {
  display: flex;
  gap: var(--aq-space-2);
}

.cell-value {
  font-weight: 600;
}

.cell-value--good {
  color: var(--aq-status-good-fg);
}

.cell-value--moderate {
  color: var(--aq-status-moderate-fg);
}

.cell-value--elevated {
  color: var(--aq-status-elevated-fg);
}

.cell-value--unhealthy {
  color: var(--aq-status-unhealthy-fg);
}

.cell-value--none {
  color: var(--aq-ink-subtle);
}
</style>

<style>
/* DataTable renders its own markup; these rules retint it with project tokens
   rather than accepting the preset's default table chrome. */
.table__grid .p-datatable-thead > tr > th {
  padding: var(--aq-space-4) var(--aq-space-4);
  background: var(--aq-surface);
  border-bottom: 1px solid var(--aq-border);
}

.table__grid .p-datatable-tbody > tr > td {
  padding: var(--aq-space-4);
  font-size: var(--aq-text-base);
  border-bottom: 1px solid var(--aq-border);
}

.table__grid .p-datatable-tbody > tr:last-child > td {
  border-bottom: 0;
}

.table__grid .p-datatable-tbody > tr:hover > td {
  background: var(--aq-surface-sunken);
}
</style>
