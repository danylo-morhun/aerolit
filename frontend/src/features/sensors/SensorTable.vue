<script setup lang="ts">
import { computed } from 'vue';

import AppButton from '@/components/ui/AppButton.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
import AqiBadge from '@/components/ui/AqiBadge.vue';
import ConnectionBadge from '@/components/ui/ConnectionBadge.vue';
import DataGrid, { type GridColumn } from '@/components/ui/DataGrid.vue';
import StateBlock from '@/components/ui/StateBlock.vue';
import WatchStar from '@/components/ui/WatchStar.vue';
import { formatConcentration } from '@/domain/format';
import type { SortableRow, SortDirection, SortKey } from '@/domain/sort';
import type { AqiCategory } from '@/domain/types';
import type { TableMode } from '@/queries/useSensorTable';

const props = defineProps<{
  rows: readonly SortableRow[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  mode: TableMode;
  loading: boolean;
  /** Rows are visible; their measured columns are still arriving. */
  enriching?: boolean;
  error: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  /** Matches in search mode, the whole network in browse; null until known. */
  total: number | null;
  /** 1-based index of the first row on screen. */
  rangeStart: number | null;
  pageSize: number;
  /** Ids currently on the dashboard watchlist. */
  watchedIds: readonly string[];
  watchlistFull: boolean;
}>();

const emit = defineEmits<{
  sort: [key: SortKey];
  next: [];
  previous: [];
  retry: [];
  toggleWatch: [stationId: string];
}>();

/** `watch` is not sortable: it reflects a local preference, not station data. */
const COLUMNS: GridColumn<SortKey | 'watch'>[] = [
  { key: 'watch', label: 'Tracked', sortable: false, labelHidden: true },
  { key: 'id', label: 'ID' },
  { key: 'district', label: 'District' },
  { key: 'location', label: 'Neighborhood' },
  { key: 'pm25', label: 'PM2.5' },
  { key: 'pm10', label: 'PM10' },
  { key: 'aqi', label: 'AQI' },
  { key: 'connection', label: 'Connection' },
];

function pmClass(category: AqiCategory | null | undefined): string {
  return `cell-value cell-value--${category ?? 'none'}`;
}

/**
 * The sort control the phone layout needs.
 *
 * Below 640 px the rows are cards and the column headers — which are where
 * sorting normally lives — are visually hidden. They stay in the accessibility
 * tree, so keyboard and screen-reader users keep sorting from the header; this
 * is the equivalent for everyone looking at the screen. It writes to the same
 * `sort` event, so there is one ordering model, not two.
 */
const SORT_OPTIONS = COLUMNS.filter((column) => column.sortable !== false).map((column) => ({
  value: column.key as SortKey,
  label: column.label,
}));

const phoneSortKey = computed<SortKey>({
  get: () => props.sortKey,
  // Selecting the column already sorted would toggle its direction, which is
  // not what picking the same entry from a list means.
  set: (key) => {
    if (key !== props.sortKey) emit('sort', key);
  },
});

const directionLabel = computed(() =>
  props.sortDirection === 'asc'
    ? 'Sorted ascending — switch to descending'
    : 'Sorted descending — switch to ascending',
);

/**
 * Where the operator is in the collection.
 *
 * The page *number* is honest — it counts pages actually walked — while a page
 * *picker* would not be: `/stations` has no offset access, so there is no way
 * to jump to page seven without walking the six before it, which the brief
 * rules out. Position without teleportation is the most this API can support.
 */
function position(props: {
  rows: readonly SortableRow[];
  total: number | null;
  rangeStart: number | null;
  pageSize: number;
}): string {
  if (props.total === null || props.rangeStart === null || props.rows.length === 0) return '';

  const last = Math.min(props.rangeStart + props.rows.length - 1, props.total);
  const page = Math.floor((props.rangeStart - 1) / props.pageSize) + 1;
  const pages = Math.max(1, Math.ceil(props.total / props.pageSize));

  return `${props.rangeStart}–${last} of ${props.total} · page ${page} of ${pages}`;
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
      <div class="table__scroll">
        <DataGrid
          :rows="rows"
          :columns="COLUMNS"
          row-key="station.id"
          :loading="loading"
          :sort-key="sortKey"
          :sort-direction="sortDirection"
          empty-title="No stations match that search"
          @sort="(key) => key !== 'watch' && emit('sort', key)"
        >
          <template #cell-watch="{ row }">
            <WatchStar
              :watched="watchedIds.includes(row.station.id)"
              :disabled="watchlistFull && !watchedIds.includes(row.station.id)"
              :station-label="`${row.station.district} ${row.station.id}`"
              @toggle="emit('toggleWatch', row.station.id)"
            />
          </template>
          <template #cell-id="{ row }">
            <span class="aq-mono cell-id">{{ row.station.id }}</span>
          </template>
          <template #cell-district="{ row }">{{ row.station.district }}</template>
          <template #cell-location="{ row }">{{ row.station.location }}</template>
          <template #cell-pm25="{ row }">
            <span :class="pmClass(row.metrics?.aqi)">
              {{ formatConcentration(row.metrics?.pm25 ?? null) }}
            </span>
          </template>
          <template #cell-pm10="{ row }">
            {{ formatConcentration(row.metrics?.pm10 ?? null) }}
          </template>
          <template #cell-aqi="{ row }">
            <AqiBadge :category="row.metrics?.aqi ?? null" size="sm" />
          </template>
          <template #cell-connection="{ row }">
            <ConnectionBadge
              :state="row.metrics?.connection ?? 'offline'"
              :stability="row.metrics?.stability ?? 0"
            />
          </template>
        </DataGrid>
      </div>

      <footer class="table__footer">
        <p class="table__status" aria-live="polite">
          <!-- While the network is still arriving, `total` is legitimately 0 —
               printing "0 matching stations" would report an answer the table
               does not have yet. -->
          <template v-if="loading && mode === 'search'">Searching the network…</template>
          <template v-else-if="enriching">Loading readings…</template>
          <template v-else-if="mode === 'search'">
            {{ total ?? 0 }} matching {{ total === 1 ? 'station' : 'stations' }}
            <template v-if="position($props)"> · {{ position($props) }}</template>
          </template>
          <template v-else-if="position($props)">
            Browsing one cursor page at a time · {{ position($props) }}
          </template>
          <template v-else>Browsing the network one page at a time</template>
        </p>

        <!-- Phone only: the column headers that normally carry sorting are
             visually hidden once the rows become cards. -->
        <div class="table__sort">
          <AppSelect
            v-model="phoneSortKey"
            size="sm"
            field-label="Sort the sensor list by"
            :options="SORT_OPTIONS"
          />
          <AppButton
            size="sm"
            variant="ghost"
            :icon="sortDirection === 'asc' ? 'pi pi-sort-amount-up' : 'pi pi-sort-amount-down'"
            :aria-label="directionLabel"
            @click="emit('sort', sortKey)"
          />
        </div>

        <div class="table__pager">
          <AppButton
            label="Previous"
            icon="pi pi-angle-left"
            size="sm"
            :disabled="!canGoPrevious || loading"
            @click="emit('previous')"
          />
          <AppButton
            label="Next"
            icon="pi pi-angle-right"
            icon-pos="right"
            size="sm"
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

/* The table is the one piece of content wide enough to need its own scroll
   container on a tablet — the page itself must never scroll sideways. */
.table__scroll {
  min-width: 0;
  overflow-x: auto;
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

/* Hidden wherever the column headers are visible and already do this job. */
.table__sort {
  display: none;
  gap: var(--aq-space-2);
  align-items: center;
}

@media (width <= 640px) {
  .table__sort {
    display: flex;
  }

  /* The footer becomes two rows on a phone: the status line, then the sort
     control and the pager side by side. */
  .table__footer {
    padding: var(--aq-space-4);
  }

  .table__status {
    flex-basis: 100%;
  }
}

/* A station id is one token: letting it wrap turns "BLN-0001" into two lines
   on a tablet, which reads as a rendering fault rather than a narrow column. */
.cell-id {
  white-space: nowrap;
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
