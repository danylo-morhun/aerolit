<script setup lang="ts">
import { computed } from 'vue';

import { formatDelta } from '@/domain/format';
import { toTrend } from '@/domain/trend';

const props = withDefaults(
  defineProps<{
    /** Week-over-week change in the KPI's own unit; `null` when unavailable. */
    delta: number | null;
    /** Whether a rising value is an improvement. */
    higherIsBetter: boolean;
    fractionDigits?: 0 | 1;
    /** Unit name, for the screen-reader sentence only. */
    unitLabel?: string;
  }>(),
  { fractionDigits: 1, unitLabel: '' },
);

const trend = computed(() =>
  props.delta === null ? null : toTrend(props.delta, props.higherIsBetter),
);
const tone = computed(() => trend.value?.tone ?? 'flat');
// The *clamped* delta, not the raw prop: a movement inside the dead band is
// reported as flat, and printing its raw "+0.0" would claim a direction the
// badge has just decided not to assert.
const text = computed(() =>
  formatDelta(trend.value === null ? null : trend.value.delta, props.fractionDigits),
);

/**
 * The arrow tracks the *tone*, not the sign — an up-right arrow means "this
 * improved", which is why the mockup pairs `−2.4` with ↗ (falling PM2.5 is
 * good news) and `+16` with ↙. The signed number carries the magnitude and
 * direction; the arrow and colour carry the interpretation.
 */
const arrow = computed(() => (tone.value === 'bad' ? '↙' : tone.value === 'good' ? '↗' : '→'));

const srLabel = computed(() => {
  if (props.delta === null) return 'No week-over-week comparison available';
  const movement =
    tone.value === 'flat' ? 'unchanged' : `${tone.value === 'good' ? 'better' : 'worse'}`;
  return `Week over week: ${text.value}${props.unitLabel ? ` ${props.unitLabel}` : ''}, ${movement}`;
});
</script>

<template>
  <span :class="['trend', `trend--${tone}`]">
    <span class="trend__arrow" aria-hidden="true">{{ arrow }}</span>
    <span class="trend__value" aria-hidden="true">{{ text }}</span>
    <span class="sr-only">{{ srLabel }}</span>
  </span>
</template>

<style scoped>
.trend {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 3px 9px;
  font-family: var(--aq-font-mono);
  font-size: var(--aq-text-2xs);
  font-weight: 500;
  white-space: nowrap;
  border-radius: var(--aq-radius-pill);
}

.trend__arrow {
  font-size: 0.8em;
  line-height: 1;
}

.trend--good {
  color: var(--aq-trend-good-fg);
  background: var(--aq-trend-good-bg);
}

.trend--bad {
  color: var(--aq-trend-bad-fg);
  background: var(--aq-trend-bad-bg);
}

.trend--flat {
  color: var(--aq-trend-flat-fg);
  background: var(--aq-trend-flat-bg);
}
</style>
