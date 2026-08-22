<script setup lang="ts" generic="T extends string">
/**
 * The pill switch used for PM2.5 / PM10 and 24H / 7D / 30D.
 *
 * Built on PrimeVue's `SelectButton` for its roving-focus keyboard behaviour
 * and ARIA wiring, restyled through tokens. Rolling our own radio group would
 * have meant re-implementing that; restyling is the smaller surface.
 */
import SelectButton from 'primevue/selectbutton';

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  /** Rendered but visually de-emphasised, e.g. a disabled longer range. */
  disabled?: boolean;
}

defineProps<{
  options: readonly SegmentOption<T>[];
  /**
   * Names the group for assistive tech, e.g. "Pollutant" or "Chart range".
   * Deliberately not called `ariaLabel`: that collides with the native
   * `aria-label` attribute in templates, where Vue cannot tell whether the
   * kebab-case form is meant as a prop or a passthrough attribute.
   */
  groupLabel: string;
  size?: 'sm' | 'md';
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <SelectButton
    v-model="model"
    :options="[...options]"
    option-label="label"
    option-value="value"
    option-disabled="disabled"
    :allow-empty="false"
    :aria-label="groupLabel"
    :class="['segmented', `segmented--${size ?? 'md'}`]"
    :pt="{ root: { role: 'radiogroup' } }"
  />
</template>

<style scoped>
.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--aq-surface-sunken);
  border-radius: var(--aq-radius-pill);
}

.segmented :deep(.p-togglebutton) {
  min-width: 0;
  padding: 6px 14px;
  font-size: var(--aq-text-xs);
  font-weight: 600;
  color: var(--aq-ink-muted);
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-radius: var(--aq-radius-pill);
  transition:
    color var(--aq-transition),
    background var(--aq-transition);
}

.segmented--sm :deep(.p-togglebutton) {
  padding: 4px 10px;
  font-size: var(--aq-text-2xs);
}

.segmented :deep(.p-togglebutton::before) {
  display: none;
}

.segmented :deep(.p-togglebutton:not(.p-disabled):not(.p-togglebutton-checked):hover) {
  color: var(--aq-ink);
  background: transparent;
}

.segmented :deep(.p-togglebutton-checked) {
  color: var(--aq-ink);
  background: var(--aq-surface);
  box-shadow: var(--aq-shadow-card);
}

.segmented :deep(.p-togglebutton.p-disabled) {
  opacity: 0.45;
}

.segmented :deep(.p-togglebutton:focus-visible) {
  outline: 2px solid var(--aq-accent);
  outline-offset: 1px;
}
</style>
