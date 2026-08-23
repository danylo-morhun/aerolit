<script setup lang="ts" generic="Row, Key extends string">
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { computed } from 'vue';

import StateBlock from './StateBlock.vue';

export interface GridColumn<K extends string> {
  key: K;
  label: string;
  sortable?: boolean;
  /**
   * Hides the header text visually but keeps it for assistive tech — for a
   * column whose meaning is carried by its control (the watch star), where a
   * blank `<th>` would leave screen-reader users with an unnamed column.
   */
  labelHidden?: boolean;
}

const props = defineProps<{
  rows: readonly Row[];
  columns: readonly GridColumn<Key>[];
  /** Dotted path to a stable row identity, e.g. `station.id`. */
  rowKey: string;
  loading?: boolean;
  sortKey?: Key;
  sortDirection?: 'asc' | 'desc';
  emptyTitle?: string;
}>();

const emit = defineEmits<{ sort: [key: Key] }>();

defineSlots<{
  /** One scoped slot per column: `#cell-<key>`. */
  [key: `cell-${string}`]: (props: { row: Row }) => unknown;
}>();

/**
 * Wraps PrimeVue's DataTable so no feature imports it directly.
 *
 * Two things this buys, both of which the brief asks for explicitly: table
 * chrome is restyled in one place (the theme preset, not here), and the
 * sorting contract is ours — the parent decides what ordering *means*, because
 * outside the table's own page it has to apply to more rows than are on
 * screen. DataTable's built-in sort would silently reorder only what it was
 * handed.
 */
/**
 * `DataTable` wants a mutable array and the rows arrive readonly. Copying in a
 * computed rather than inline in the template means the copy is made when the
 * rows actually change, not on every unrelated re-render — a new array
 * identity is what makes the table re-diff all twenty rows.
 */
const tableRows = computed(() => [...props.rows]);

function sortState(key: Key): 'ascending' | 'descending' | 'none' {
  if (props.sortKey !== key) return 'none';
  return props.sortDirection === 'desc' ? 'descending' : 'ascending';
}

function sortIcon(key: Key): string {
  if (props.sortKey !== key) return 'pi pi-sort-alt';
  return props.sortDirection === 'desc' ? 'pi pi-sort-down-fill' : 'pi pi-sort-up-fill';
}
</script>

<template>
  <DataTable :value="tableRows" :data-key="rowKey" :loading="loading" scrollable class="grid">
    <Column
      v-for="column in columns"
      :key="column.key"
      :field="column.key"
      :pt="{
        // `aria-sort` belongs on the header cell itself, not on a control
        // inside it — assistive tech reads it off the column header.
        headerCell: column.sortable === false ? {} : { 'aria-sort': sortState(column.key) },
      }"
    >
      <template #header>
        <span
          v-if="column.sortable === false"
          :class="column.labelHidden ? 'sr-only' : 'grid__label'"
          >{{ column.label }}</span
        >
        <button v-else type="button" class="grid__sort" @click="emit('sort', column.key)">
          {{ column.label }}
          <i :class="[sortIcon(column.key), 'grid__sort-icon']" aria-hidden="true" />
          <span class="sr-only">
            — sort by {{ column.label }},
            {{ sortState(column.key) === 'none' ? 'not sorted' : sortState(column.key) }}
          </span>
        </button>
      </template>

      <template #body="{ data }">
        <slot :name="`cell-${column.key}`" :row="data as Row" />
      </template>
    </Column>

    <template #empty>
      <StateBlock
        :state="loading ? 'loading' : 'empty'"
        :title="loading ? 'Loading…' : (emptyTitle ?? 'Nothing to show')"
        compact
      />
    </template>
  </DataTable>
</template>

<style scoped>
.grid__label,
.grid__sort {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 0;
  font-size: var(--aq-text-2xs);
  font-weight: 600;
  color: var(--aq-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: none;
  border: 0;
}

.grid__sort {
  cursor: pointer;
}

.grid__sort:hover {
  color: var(--aq-ink);
}

.grid__sort-icon {
  font-size: 9px;
  opacity: 0.7;
}
</style>
