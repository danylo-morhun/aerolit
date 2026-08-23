<script setup lang="ts">
import { computed } from 'vue';

import StatTile from '@/components/ui/StatTile.vue';
import { AQI_LABELS, classify } from '@/domain/aqi';
import { formatConcentrationPrecise, formatPercentPrecise } from '@/domain/format';
import { kpiDeltas, type KpiSnapshot } from '@/domain/kpi';

const props = defineProps<{
  kpis: KpiSnapshot | null;
  reference: KpiSnapshot | null;
  loading?: boolean;
}>();

const deltas = computed(() => (props.kpis ? kpiDeltas(props.kpis, props.reference) : null));

/** "Avg PM2.5 · Moderate" — the number plus what it means, as in the mockup. */
const avgLabel = computed(() => {
  const category = classify(props.kpis?.avgPm25 ?? null);
  return category ? `Avg PM2.5 · ${AQI_LABELS[category]}` : 'Avg PM2.5';
});
</script>

<template>
  <div class="kpis">
    <StatTile
      label="Active Sensors"
      icon="pi pi-wifi"
      tone="accent"
      :value="String(kpis?.activeSensors ?? 0)"
      :delta="deltas?.activeSensors ?? null"
      :higher-is-better="true"
      :delta-fraction-digits="0"
      delta-unit-label="sensors"
      :loading="loading"
    />
    <StatTile
      :label="avgLabel"
      icon="pi pi-cloud"
      tone="good"
      unit="µg"
      :value="formatConcentrationPrecise(kpis?.avgPm25 ?? null)"
      :delta="deltas?.avgPm25 ?? null"
      :higher-is-better="false"
      :delta-fraction-digits="1"
      delta-unit-label="µg/m³"
      :loading="loading"
    />
    <StatTile
      label="Poor Connection"
      icon="pi pi-exclamation-triangle"
      tone="bad"
      :value="String(kpis?.poorConnections ?? 0)"
      :delta="deltas?.poorConnections ?? null"
      :higher-is-better="false"
      :delta-fraction-digits="0"
      delta-unit-label="stations"
      :loading="loading"
    />
    <StatTile
      label="Network Stability"
      icon="pi pi-wave-pulse"
      tone="neutral"
      unit="%"
      :value="formatPercentPrecise(kpis?.networkStability ?? null)"
      :delta="deltas?.networkStability ?? null"
      :higher-is-better="true"
      :delta-fraction-digits="1"
      delta-unit-label="percentage points"
      :loading="loading"
    />
  </div>
</template>

<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--aq-space-4);
}

/* iPad portrait and below: two rows of two rather than four cramped columns —
   the KPI values are the largest type on the page and must not wrap. */
@media (width <= 900px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Small phones only. Two columns still read at 390 px — only the longest label
   wraps — and they keep the map near the top of the page instead of behind
   four full-width tiles. At 360 px and below the short labels wrap too
   ("Poor Connection" over two lines under a 34 px figure reads as a fault),
   and one column is the honest answer. */
@media (width <= 360px) {
  .kpis {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
