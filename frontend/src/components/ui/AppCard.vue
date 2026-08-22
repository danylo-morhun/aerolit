<script setup lang="ts">
/**
 * The panel surface every block on both pages sits on.
 *
 * Deliberately not PrimeVue's `Card`: that component ships a fixed
 * header/body/footer structure with its own padding scale, and every panel in
 * the mockup wanted a different combination of it. Wrapping a plain section in
 * our own tokens is less markup than overriding those slots, and it keeps the
 * radius/border/shadow of every panel in one file.
 */
defineProps<{
  title?: string;
  subtitle?: string;
  /** Removes body padding, for panels whose content bleeds to the edge (map). */
  flush?: boolean;
}>();

defineSlots<{
  default: () => unknown;
  actions?: () => unknown;
}>();
</script>

<template>
  <section class="card">
    <header v-if="title || $slots.actions" class="card__header">
      <div v-if="title" class="card__heading">
        <h2 class="card__title">{{ title }}</h2>
        <p v-if="subtitle" class="card__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="card__actions">
        <slot name="actions" />
      </div>
    </header>

    <div :class="['card__body', { 'card__body--flush': flush }]">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--aq-surface);
  border: 1px solid var(--aq-border);
  border-radius: var(--aq-radius-xl);
  box-shadow: var(--aq-shadow-card);
}

.card__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aq-space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--aq-space-5) var(--aq-space-5) var(--aq-space-4);
}

.card__heading {
  min-width: 0;
}

.card__title {
  font-size: var(--aq-text-md);
  font-weight: 700;
}

.card__subtitle {
  margin-top: 2px;
  font-size: var(--aq-text-sm);
  color: var(--aq-ink-muted);
}

.card__body {
  flex: 1;
  min-height: 0;
  padding: 0 var(--aq-space-5) var(--aq-space-5);
}

.card__body--flush {
  padding: 0;
}

/* A header-less card still needs its top padding back. */
.card__header + .card__body--flush {
  padding: 0;
}

.card > .card__body:first-child {
  padding-top: var(--aq-space-5);
}

.card > .card__body--flush:first-child {
  padding-top: 0;
}
</style>
