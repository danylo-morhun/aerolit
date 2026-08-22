<script setup lang="ts">
import { computed } from 'vue';

import { AQI_LABELS } from '@/domain/aqi';
import type { AqiCategory } from '@/domain/types';

const props = withDefaults(
  defineProps<{
    category: AqiCategory | null;
    size?: 'sm' | 'md';
  }>(),
  { size: 'md' },
);

/** A station with no reading has no air quality — say so, don't imply "good". */
const label = computed(() => (props.category ? AQI_LABELS[props.category] : 'No data'));
</script>

<template>
  <span :class="['badge', `badge--${category ?? 'none'}`, `badge--${size}`]">
    {{ label }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  font-size: var(--aq-text-2xs);
  font-weight: 600;
  white-space: nowrap;
  border-radius: var(--aq-radius-pill);
}

.badge--sm {
  padding: 2px 8px;
}

.badge--good {
  color: var(--aq-chip-good-fg);
  background: var(--aq-chip-good-bg);
}

.badge--moderate {
  color: var(--aq-chip-moderate-fg);
  background: var(--aq-chip-moderate-bg);
}

.badge--elevated {
  color: var(--aq-chip-elevated-fg);
  background: var(--aq-chip-elevated-bg);
}

.badge--unhealthy {
  color: var(--aq-chip-unhealthy-fg);
  background: var(--aq-chip-unhealthy-bg);
}

.badge--none {
  color: var(--aq-ink-muted);
  background: var(--aq-surface-sunken);
}

/* The chips keep their light backgrounds in dark mode — they read as labels
   rather than surfaces, and the mockup shows them that way. Their token pair is
   therefore defined once in tokens.css and never re-pointed, which is what
   keeps the text/background contrast valid in both themes. */
</style>
