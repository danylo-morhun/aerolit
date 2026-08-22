<script setup lang="ts">
import Button from 'primevue/button';

/**
 * The loading / error / empty placeholder every data panel falls back to.
 *
 * One component rather than three because the three states differ only in
 * icon, tone and whether a retry is offered — keeping them together is what
 * stops one panel growing a spinner the others don't have.
 */
withDefaults(
  defineProps<{
    state: 'loading' | 'error' | 'empty';
    title?: string;
    description?: string;
    /** Shows a retry button when provided. */
    onRetry?: (() => void) | undefined;
    compact?: boolean;
  }>(),
  { title: '', description: '', onRetry: undefined, compact: false },
);

const DEFAULT_TITLES = {
  loading: 'Loading…',
  error: 'Something went wrong',
  empty: 'Nothing to show',
} as const;
</script>

<template>
  <div :class="['state', { 'state--compact': compact }]" :aria-busy="state === 'loading'">
    <i
      :class="[
        'state__icon',
        state === 'loading'
          ? 'pi pi-spinner pi-spin'
          : state === 'error'
            ? 'pi pi-exclamation-triangle state__icon--error'
            : 'pi pi-inbox',
      ]"
      aria-hidden="true"
    />
    <p class="state__title">{{ title || DEFAULT_TITLES[state] }}</p>
    <p v-if="description" class="state__description">{{ description }}</p>
    <Button
      v-if="onRetry && state === 'error'"
      class="state__retry"
      label="Try again"
      size="small"
      severity="secondary"
      outlined
      @click="onRetry"
    />
  </div>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  gap: var(--aq-space-2);
  align-items: center;
  justify-content: center;
  padding: var(--aq-space-8) var(--aq-space-4);
  text-align: center;
}

.state--compact {
  padding: var(--aq-space-5) var(--aq-space-3);
}

.state__icon {
  font-size: 20px;
  color: var(--aq-ink-subtle);
}

.state__icon--error {
  color: var(--aq-status-unhealthy-fg);
}

.state__title {
  font-size: var(--aq-text-base);
  font-weight: 600;
}

.state__description {
  max-width: 42ch;
  font-size: var(--aq-text-sm);
  color: var(--aq-ink-muted);
}

.state__retry {
  margin-top: var(--aq-space-2);
}
</style>
