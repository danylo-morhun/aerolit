<script setup lang="ts">
/**
 * A neutral label/value pill — the "PM10 97" chip in the watchlist.
 *
 * Separate from `AqiBadge` because it carries no judgement: it states a
 * secondary number without claiming anything about whether it is good.
 */
defineProps<{
  label: string;
  value: string;
}>();
</script>

<template>
  <span class="chip">
    <span class="chip__label">{{ label }}</span>
    <span class="chip__value">{{ value }}</span>
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  gap: 6px;
  align-items: baseline;
  padding: 3px 9px;
  font-family: var(--aq-font-mono);
  font-size: var(--aq-text-2xs);
  white-space: nowrap;
  background: var(--aq-surface-sunken);
  border-radius: var(--aq-radius-pill);
}

.chip__label {
  color: var(--aq-ink-muted);
}

.chip__value {
  font-weight: 500;
  color: var(--aq-ink);
}
</style>
