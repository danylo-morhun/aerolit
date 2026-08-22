<script setup lang="ts">
import { computed } from 'vue';

import { useThemeStore } from '@/stores/theme';

const theme = useThemeStore();

const label = computed(() => (theme.isDark ? 'Switch to light theme' : 'Switch to dark theme'));
</script>

<template>
  <button
    type="button"
    class="toggle"
    :aria-label="label"
    :title="label"
    :aria-pressed="theme.isDark"
    @click="theme.toggle()"
  >
    <i :class="theme.isDark ? 'pi pi-sun' : 'pi pi-moon'" aria-hidden="true" />
  </button>
</template>

<style scoped>
.toggle {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 44px;
  height: 44px;
  font-size: 16px;
  color: var(--aq-ink);
  cursor: pointer;
  background: var(--aq-surface);
  border: 1px solid var(--aq-border);
  border-radius: var(--aq-radius-lg);
  transition: background var(--aq-transition);
}

.toggle:hover {
  background: var(--aq-surface-sunken);
}
</style>
