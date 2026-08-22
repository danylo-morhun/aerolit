<script setup lang="ts">
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { computed } from 'vue';
import VChart from 'vue-echarts';

import AppCard from '@/components/ui/AppCard.vue';
import SegmentedToggle from '@/components/ui/SegmentedToggle.vue';
import StateBlock from '@/components/ui/StateBlock.vue';
import { chartSeries } from '@/domain/downsample';
import { formatDateTime, formatDay, formatHour } from '@/domain/format';
import type { ChartRange, ReadingSeries, Station } from '@/domain/types';
import { cssVars } from '@/theme/cssVar';
import { useThemeStore } from '@/stores/theme';

const props = defineProps<{
  station: Station | null;
  series: ReadingSeries | null;
  /** Snapshot instant the ranges are measured back from. */
  now: number | null;
  loading?: boolean;
}>();

const range = defineModel<ChartRange>('range', { required: true });

// Only the pieces this chart draws — the full ECharts bundle is ~1 MB and we
// use a bar series, a line series, a grid and a tooltip.
use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

const theme = useThemeStore();

const points = computed(() =>
  props.series && props.now !== null ? chartSeries(props.series, range.value, props.now) : [],
);

const hasData = computed(() => points.value.some((p) => p.pm25 !== null || p.pm10 !== null));

/** 24H labels every reading by hour; longer ranges label by day. */
const labelFor = computed(() => (range.value === '24h' ? formatHour : formatDay));

const subtitle = computed(() => {
  if (!props.station) return 'Select a station';
  return `${props.station.district} · ${props.station.location} · ${range.value.toUpperCase()} · µg/m³`;
});

/**
 * Palette pulled from the same tokens as the rest of the UI.
 *
 * Depending on `theme.isDark` is what makes this recompute on the theme
 * toggle: the values are read from the computed style, which only changes
 * after the `.dark` class flips, so the reactive dependency has to be the
 * class rather than the variables themselves.
 */
const palette = computed(() => {
  void theme.isDark;
  return cssVars({
    pm10: '--aq-viz-pm10',
    pm25: '--aq-viz-pm25',
    grid: '--aq-viz-grid',
    axis: '--aq-viz-axis',
    surface: '--aq-surface',
    border: '--aq-border',
    ink: '--aq-ink',
    inkMuted: '--aq-ink-muted',
    areaFrom: '--aq-viz-area-from',
  });
});

const option = computed(() => {
  const colours = palette.value;
  const data = points.value;

  return {
    animationDuration: 240,
    // ECharts' own accessibility layer: it renders the series into a
    // description on the canvas element, which is the only way a screen reader
    // can reach data drawn to a bitmap. The card subtitle names the station and
    // range; this names the numbers.
    aria: { enabled: true, label: { enabled: true } },
    grid: { top: 16, right: 8, bottom: 28, left: 44 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colours.surface,
      borderColor: colours.border,
      textStyle: { color: colours.ink, fontSize: 12 },
      axisPointer: { type: 'shadow', shadowStyle: { color: `${colours.grid}66` } },
      formatter: (params: unknown) => {
        const rows = Array.isArray(params) ? params : [params];
        const first = rows[0] as { dataIndex?: number } | undefined;
        const point = first?.dataIndex === undefined ? undefined : data[first.dataIndex];
        if (!point) return '';
        const fmt = (value: number | null) => (value === null ? '—' : value.toFixed(1));
        return [
          `<strong>${formatDateTime(point.t)}</strong>`,
          `PM2.5 ${fmt(point.pm25)} µg/m³`,
          `PM10 ${fmt(point.pm10)} µg/m³`,
        ].join('<br>');
      },
    },
    xAxis: {
      type: 'category',
      data: data.map((p) => labelFor.value(p.t)),
      axisLine: { lineStyle: { color: colours.grid } },
      axisTick: { show: false },
      axisLabel: {
        color: colours.axis,
        fontSize: 11,
        // Keep every third tick so 30 daily buckets don't overlap.
        interval: Math.max(0, Math.ceil(data.length / 9) - 1),
      },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: colours.grid } },
      axisLabel: { color: colours.axis, fontSize: 11 },
    },
    series: [
      {
        name: 'PM10',
        type: 'bar',
        data: data.map((p) => p.pm10),
        itemStyle: { color: colours.pm10, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 18,
      },
      {
        name: 'PM2.5',
        type: 'line',
        data: data.map((p) => p.pm25),
        smooth: 0.35,
        symbol: 'none',
        // A gap in the data stays a gap: connecting across a missing hour
        // would draw a reading the station never filed.
        connectNulls: false,
        lineStyle: { color: colours.pm25, width: 2 },
        itemStyle: { color: colours.pm25 },
        areaStyle: { color: colours.areaFrom },
      },
    ],
  };
});
</script>

<template>
  <AppCard title="Particulate Concentration over Time" :subtitle="subtitle">
    <template #actions>
      <div class="chart__controls">
        <ul class="chart__legend">
          <li><span class="chart__swatch chart__swatch--pm10" aria-hidden="true" />PM10</li>
          <li><span class="chart__swatch chart__swatch--pm25" aria-hidden="true" />PM2.5</li>
        </ul>
        <SegmentedToggle
          v-model="range"
          size="sm"
          group-label="Chart range"
          :options="[
            { value: '24h', label: '24H' },
            { value: '7d', label: '7D' },
            { value: '30d', label: '30D' },
          ]"
        />
      </div>
    </template>

    <StateBlock v-if="loading" state="loading" />
    <StateBlock
      v-else-if="!station"
      state="empty"
      title="No station selected"
      description="Pick a marker on the map or a row in the watchlist."
    />
    <StateBlock
      v-else-if="!hasData"
      state="empty"
      title="No readings in this range"
      description="This station filed nothing over the selected window."
    />
    <VChart v-else class="chart" :option="option" autoresize :aria-label="subtitle" />
  </AppCard>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 340px;
}

.chart__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aq-space-4);
  align-items: center;
}

.chart__legend {
  display: flex;
  gap: var(--aq-space-4);
  padding: 0;
  margin: 0;
  font-size: var(--aq-text-xs);
  color: var(--aq-ink-muted);
  list-style: none;
}

.chart__legend li {
  display: flex;
  gap: 6px;
  align-items: center;
}

.chart__swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.chart__swatch--pm10 {
  background: var(--aq-viz-pm10);
}

.chart__swatch--pm25 {
  background: var(--aq-viz-pm25);
  border-radius: 50%;
}

@media (width <= 900px) {
  .chart {
    height: 260px;
  }
}
</style>
