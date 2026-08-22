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
  color: var(--aq-c-good);
  background: var(--aq-status-good-bg);
}

.badge--moderate {
  color: var(--aq-c-moderate);
  background: var(--aq-status-moderate-bg);
}

.badge--elevated {
  color: var(--aq-c-elevated);
  background: var(--aq-status-elevated-bg);
}

.badge--unhealthy {
  color: var(--aq-c-unhealthy);
  background: var(--aq-status-unhealthy-bg);
}

.badge--none {
  color: var(--aq-ink-muted);
  background: var(--aq-surface-sunken);
}

/* The tinted chips keep their light backgrounds in dark mode — they read as
   labels rather than surfaces, and the mockup shows them that way — so the
   text colour stays the dark-on-tint variant regardless of theme. */
</style>
