<script setup lang="ts">
import ThemeToggle from './ThemeToggle.vue';

/**
 * The persistent frame both pages render inside: brand, tab navigation and the
 * theme control.
 *
 * Navigation is `RouterLink`, not a PrimeVue tab component — each page is a
 * real URL that must survive a reload and be shareable, so the browser's own
 * navigation semantics (middle-click, back button, focus handling) are worth
 * more here than a tab widget's styling.
 */
const NAV = [
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'sensors', label: 'Sensor List' },
] as const;
</script>

<template>
  <div class="shell">
    <header class="shell__bar">
      <span class="shell__brand">Aerolit</span>

      <nav class="shell__nav" aria-label="Main">
        <RouterLink
          v-for="item in NAV"
          :key="item.name"
          class="shell__tab"
          active-class="shell__tab--active"
          :to="{ name: item.name }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <ThemeToggle />
    </header>

    <main id="main" class="shell__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  gap: var(--aq-space-6);
  width: 100%;
  max-width: 1760px;
  min-height: 100dvh;
  padding: var(--aq-space-5) var(--aq-space-8) var(--aq-space-8);
  margin-inline: auto;
}

.shell__bar {
  display: flex;
  gap: var(--aq-space-4);
  align-items: center;
}

.shell__brand {
  flex-shrink: 0;
  padding-inline: var(--aq-space-2);
  font-size: var(--aq-text-md);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.shell__nav {
  display: flex;
  flex: 1;
  gap: var(--aq-space-1);
  align-items: center;
  min-width: 0;
  padding: var(--aq-space-2);
  overflow-x: auto;
  background: var(--aq-surface-sunken);
  border-radius: var(--aq-radius-lg);
  scrollbar-width: none;
}

.shell__tab {
  padding: 8px 18px;
  font-size: var(--aq-text-base);
  font-weight: 600;
  color: var(--aq-ink-muted);
  text-decoration: none;
  white-space: nowrap;
  border-radius: var(--aq-radius-md);
  transition:
    color var(--aq-transition),
    background var(--aq-transition);
}

.shell__tab:hover {
  color: var(--aq-ink);
}

.shell__tab--active {
  color: var(--aq-ink);
  background: var(--aq-surface);
  box-shadow: var(--aq-shadow-card);
}

.shell__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--aq-space-5);
  min-width: 0;
}

/* iPad and narrow desktop: reclaim the generous desktop gutters. */
@media (width <= 1024px) {
  .shell {
    gap: var(--aq-space-5);
    padding: var(--aq-space-4);
  }
}
</style>
