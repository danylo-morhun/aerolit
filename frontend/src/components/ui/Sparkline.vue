<script setup lang="ts">
import { computed } from 'vue';

import type { AqiCategory } from '@/domain/types';

const props = withDefaults(
  defineProps<{
    /** Oldest first. Fewer than two points renders nothing. */
    values: readonly number[];
    /** Drives the stroke colour, so the glyph agrees with the row's badge. */
    category?: AqiCategory | null;
    label?: string;
  }>(),
  { category: null, label: 'Last 24 hours' },
);

const VIEW_W = 100;
const VIEW_H = 32;
const PADDING = 3;

/**
 * Normalises the series into the viewBox.
 *
 * The vertical scale is per-sparkline (min→max of its own values) rather than
 * a shared network-wide scale: at this size the glyph communicates *shape* —
 * whether a station is climbing, spiking or flat — and a shared scale would
 * flatten most rows into a straight line. The numeric value next to it is what
 * conveys magnitude.
 */
const geometry = computed(() => {
  const values = props.values;
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (VIEW_W - PADDING * 2) / (values.length - 1);

  const points = values.map((value, index) => {
    const x = PADDING + index * step;
    const y = VIEW_H - PADDING - ((value - min) / span) * (VIEW_H - PADDING * 2);
    return { x, y };
  });

  const line = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${PADDING},${VIEW_H} ${line} ${(VIEW_W - PADDING).toFixed(2)},${VIEW_H}`;

  return { points, line, area, last: points[points.length - 1] };
});
</script>

<template>
  <svg
    v-if="geometry"
    class="spark"
    :class="`spark--${category ?? 'none'}`"
    :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
    preserveAspectRatio="none"
    role="img"
    :aria-label="label"
  >
    <polygon class="spark__area" :points="geometry.area" />
    <polyline
      class="spark__line"
      :points="geometry.line"
      fill="none"
      vector-effect="non-scaling-stroke"
    />
    <circle
      v-if="geometry.last"
      class="spark__head"
      :cx="geometry.last.x"
      :cy="geometry.last.y"
      r="1.6"
    />
  </svg>
  <span v-else class="spark spark--empty" role="img" aria-label="No recent readings">—</span>
</template>

<style scoped>
/* Colours come from the graphic primitives, not the text tokens: a sparkline
   is a graphic (WCAG 1.4.11 asks 3:1, not 4.5:1), and keeping the vivid hue is
   what makes a row scannable at a glance. */
.spark {
  width: 100%;
  height: 32px;
  overflow: visible;
  color: var(--aq-ink-subtle);
}

.spark--good {
  color: var(--aq-c-good);
}

.spark--moderate {
  color: var(--aq-c-moderate);
}

.spark--elevated {
  color: var(--aq-c-elevated);
}

.spark--unhealthy {
  color: var(--aq-c-unhealthy);
}

.spark__line {
  stroke: currentcolor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.spark__area {
  fill: currentcolor;
  opacity: 0.12;
}

.spark__head {
  fill: currentcolor;
}

.spark--empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  color: var(--aq-ink-subtle);
}
</style>
