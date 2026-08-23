<script setup lang="ts" generic="T extends string">
import Select from 'primevue/select';

/**
 * The project's dropdown.
 *
 * Exists for one caller — the sensor table's phone sort control — and is a
 * shared component anyway, because the alternative is a feature reaching for
 * `primevue/select` directly, which the lint rule forbids and the brief rules
 * out. The prop surface is the narrow one this app needs, not PrimeVue's.
 */
export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

defineProps<{
  options: readonly SelectOption<T>[];
  /**
   * Names the control for assistive tech; there is no visible label.
   * Not `ariaLabel`, for the same reason `SegmentedToggle` avoids it: the
   * kebab-case form collides with the native `aria-label` attribute in
   * templates, and Vue resolves it as a passthrough rather than as this prop.
   */
  fieldLabel: string;
  size?: 'sm' | 'md';
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <Select
    v-model="model"
    :options="[...options]"
    option-label="label"
    option-value="value"
    :aria-label="fieldLabel"
    :class="['app-select', `app-select--${size ?? 'md'}`]"
  />
</template>

<style scoped>
.app-select {
  align-items: center;
  background: var(--aq-surface-input);
  border: 1px solid var(--aq-border);
  border-radius: var(--aq-radius-md);
}

.app-select :deep(.p-select-label) {
  padding: 6px 10px;
  font-size: var(--aq-text-xs);
  font-weight: 600;
  color: var(--aq-ink);
}

.app-select--sm :deep(.p-select-label) {
  padding: 5px 8px;
  font-size: var(--aq-text-2xs);
}

.app-select :deep(.p-select-dropdown) {
  width: 1.75rem;
  color: var(--aq-ink-muted);
}
</style>
