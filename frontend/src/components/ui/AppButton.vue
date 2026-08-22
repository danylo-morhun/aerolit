<script setup lang="ts">
import Button from 'primevue/button';

/**
 * The project's button.
 *
 * Every button in the app goes through here rather than reaching for
 * PrimeVue's directly, which is what makes a restyle a single edit instead of
 * a search across features. The prop surface is deliberately narrower than
 * PrimeVue's — three variants and two sizes is everything the interface
 * actually uses, and each new one should be a deliberate addition here.
 */
withDefaults(
  defineProps<{
    label?: string;
    /** PrimeIcons class, e.g. `pi pi-angle-left`. */
    icon?: string;
    iconPos?: 'left' | 'right';
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md';
    disabled?: boolean;
    type?: 'button' | 'submit';
    /** Names an icon-only button for assistive tech. */
    ariaLabel?: string;
  }>(),
  // Optional props are left out rather than defaulted to `undefined`:
  // `exactOptionalPropertyTypes` treats "absent" and "present but undefined"
  // as different, and only the first is what we mean here.
  { iconPos: 'left', variant: 'secondary', size: 'md', disabled: false, type: 'button' },
);

defineEmits<{ click: [event: MouseEvent] }>();
</script>

<template>
  <Button
    :type="type"
    :label="label"
    :icon="icon"
    :icon-pos="iconPos"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :severity="variant === 'primary' ? undefined : 'secondary'"
    :outlined="variant === 'secondary'"
    :text="variant === 'ghost'"
    :class="['app-button', `app-button--${size}`]"
    @click="$emit('click', $event)"
  />
</template>

<style scoped>
.app-button {
  font-weight: 600;
  border-radius: var(--aq-radius-md);
}

.app-button--sm {
  padding: 6px 12px;
  font-size: var(--aq-text-xs);
}

.app-button--md {
  padding: 9px 16px;
  font-size: var(--aq-text-base);
}
</style>
