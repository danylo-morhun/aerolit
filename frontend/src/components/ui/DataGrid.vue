<script setup lang="ts" generic="Row, Key extends string">
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { computed } from 'vue';

import { isPhone } from '@/theme/breakpoints';

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
  <DataTable
    :value="tableRows"
    :data-key="rowKey"
    :loading="loading"
    :scrollable="!isPhone"
    class="grid"
    :pt="{
      // Roles spelled out rather than left implicit: below the phone
      // breakpoint the rows are laid out as cards, and changing a `tr` or `td`
      // away from its table `display` is exactly what makes a browser drop the
      // implicit table semantics from the accessibility tree. At desktop these
      // restate what the markup already means and cost nothing.
      table: { role: 'table' },
      thead: { role: 'rowgroup' },
      headerRow: { role: 'row' },
      tbody: { role: 'rowgroup' },
      bodyRow: { role: 'row' },
      // The empty state is PrimeVue's own row, outside the Column loop below,
      // so it needs the same treatment: on a phone a search that matches
      // nothing would otherwise leave a `rowgroup` containing no `row`.
      emptyMessage: { role: 'row' },
      emptyMessageCell: { role: 'cell' },
    }"
  >
    <Column
      v-for="column in columns"
      :key="column.key"
      :field="column.key"
      :pt="{
        // `aria-sort` belongs on the header cell itself, not on a control
        // inside it — assistive tech reads it off the column header.
        headerCell: {
          role: 'columnheader',
          ...(column.sortable === false ? {} : { 'aria-sort': sortState(column.key) }),
        },
        // The label travels with the cell so the card layout can print it
        // beside the value; a card with a bare number in it says nothing.
        bodyCell: { role: 'cell', 'data-label': column.labelHidden ? '' : column.label },
      }"
    >
      <template #header>
        <span
          v-if="column.sortable === false"
          :class="column.labelHidden ? 'sr-only' : 'grid__label'"
          >{{ column.label }}</span
        >
        <!-- `tabindex="-1"` below the phone breakpoint: the header is collapsed
             to a pixel there, so these seven buttons would be seven tab stops
             with no visible focus — a 2.4.7 failure that an axe pass cannot
             see, because it cannot evaluate focus visibility. They stay in the
             accessibility tree for a screen reader's virtual cursor, and the
             sensor table's footer carries the equivalent visible control. -->
        <button
          v-else
          type="button"
          class="grid__sort"
          :tabindex="isPhone ? -1 : undefined"
          @click="emit('sort', column.key)"
        >
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

/**
 * Phone: one card per row instead of eight columns.
 *
 * A table this wide on a 390 px screen shows three columns and hides the four
 * that carry the readings behind a sideways scroll — the half an operator
 * opened it for. Each row becomes a card and each cell a label/value line,
 * with the label coming from the `data-label` the column already carries.
 *
 * The header is hidden with the `sr-only` technique rather than
 * `display: none`: that keeps the column headers in the accessibility tree,
 * keeps their `aria-sort`, and leaves the sort buttons reachable by keyboard.
 * Sighted phone users get the equivalent control in the table footer.
 */
@media (width <= 640px) {
  /* Collapsed by height and clipping rather than by `position: absolute`:
     PrimeVue writes `position: sticky` inline on the thead, and an inline
     declaration beats any stylesheet rule no matter how it is written. This
     needs no position at all — and unlike `display: none` or
     `visibility: hidden` it leaves the column headers, their `aria-sort` and
     the sort buttons in the accessibility tree. */
  .grid :deep(thead) {
    display: block;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .grid :deep(table),
  .grid :deep(tbody),
  .grid :deep(tr),
  .grid :deep(td) {
    display: block;
    width: auto;
  }

  .grid :deep(tbody tr) {
    padding: var(--aq-space-3) var(--aq-space-4);
    margin: var(--aq-space-3) var(--aq-space-4);
    background: var(--aq-surface-sunken);
    border: 1px solid var(--aq-border);
    border-radius: var(--aq-radius-lg);
  }

  .grid :deep(tbody td) {
    display: flex;
    gap: var(--aq-space-4);
    align-items: baseline;
    justify-content: space-between;
    padding: 3px 0;
    border: 0;
  }

  /* The label sits opposite its value, so the card reads as a definition list
     rather than as a column that lost its heading. */
  .grid :deep(tbody td[data-label]:not([data-label='']))::before {
    content: attr(data-label);
    font-size: var(--aq-text-2xs);
    font-weight: 600;
    color: var(--aq-ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* The watch star has no label to print and belongs at the card's top edge,
     next to the id it applies to. */
  .grid :deep(tbody td[data-label='']) {
    justify-content: flex-end;
    padding: 0;
  }
}
</style>
