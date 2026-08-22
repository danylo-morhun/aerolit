<script setup lang="ts">
import { ref } from 'vue';

import PageHeader from '@/components/layout/PageHeader.vue';
import SensorTable from '@/features/sensors/SensorTable.vue';
import { useSensorTable } from '@/queries/useSensorTable';

defineOptions({ name: 'SensorListPage' });

const query = ref('');
const table = useSensorTable(query);
</script>

<template>
  <PageHeader v-model:query="query" title="Sensor List" />

  <SensorTable
    :rows="table.rows.value"
    :sort-key="table.sortKey.value"
    :sort-direction="table.sortDirection.value"
    :mode="table.mode.value"
    :loading="table.isLoading.value"
    :error="table.isError.value"
    :can-go-next="table.canGoNext.value"
    :can-go-previous="table.canGoPrevious.value"
    :total="table.mode.value === 'search' ? table.searchTotal.value : null"
    :range-start="table.rangeStart.value"
    @sort="table.toggleSort"
    @next="table.next"
    @previous="table.previous"
    @retry="table.refetch"
  />
</template>
