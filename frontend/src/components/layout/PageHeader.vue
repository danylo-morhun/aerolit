<script setup lang="ts">
import SearchInput from '@/components/ui/SearchInput.vue';

/**
 * Page title plus the lookup field.
 *
 * The field is shared but the *state* is not: each page owns its query,
 * because the two mean different things — filtering a table of every station,
 * versus narrowing the map and watchlist on the dashboard. Hoisting the query
 * into a store would have coupled two behaviours that only look alike.
 */
defineProps<{
  title: string;
}>();

const query = defineModel<string>('query', { default: '' });
</script>

<template>
  <div class="header">
    <h1 class="header__title">{{ title }}</h1>
    <SearchInput v-model="query" class="header__search" />
  </div>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--aq-space-4);
  align-items: center;
  justify-content: space-between;
  padding-inline: var(--aq-space-2);
}

.header__title {
  font-size: var(--aq-text-xl);
  font-weight: 800;
  letter-spacing: -0.02em;
}

.header__search {
  flex: 0 1 320px;
}

@media (width <= 640px) {
  .header__search {
    flex-basis: 100%;
    max-width: none;
  }
}
</style>
