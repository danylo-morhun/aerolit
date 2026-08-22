<script setup lang="ts">
import { ref } from 'vue';

import PageHeader from '@/components/layout/PageHeader.vue';
import SensorTable from '@/features/sensors/SensorTable.vue';
import { useSensorTable } from '@/queries/useSensorTable';
import { useWatchlistStore } from '@/stores/watchlist';

defineOptions({ name: 'SensorListPage' });

const query = ref('');
const table = useSensorTable(query);
const watchlist = useWatchlistStore();
</script>

<template>
  <PageHeader v-model:query="query" title="Sensor List" />

  <SensorTable
    :rows="table.rows.value"
    :sort-key="table.sortKey.value"
    :sort-direction="table.sortDirection.value"
    :mode="table.mode.value"
    :loading="table.isLoading.value"
    :enriching="table.isEnriching.value"
    :error="table.isError.value"
    :can-go-next="table.canGoNext.value"
    :can-go-previous="table.canGoPrevious.value"
    :total="table.mode.value === 'search' ? table.searchTotal.value : null"
    :range-start="table.rangeStart.value"
    :watched-ids="watchlist.ids"
    :watchlist-full="watchlist.isFull"
    @sort="table.toggleSort"
    @next="table.next"
    @previous="table.previous"
    @retry="table.refetch"
    @toggle-watch="watchlist.toggle"
  />
</template>
