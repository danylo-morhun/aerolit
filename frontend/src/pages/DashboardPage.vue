<script setup lang="ts">
import { ref } from 'vue';

import PageHeader from '@/components/layout/PageHeader.vue';

defineOptions({ name: 'DashboardPage' });

const query = ref('');
</script>

<template>
  <PageHeader v-model:query="query" title="Berlin · Particulate Monitoring" />
</template>
