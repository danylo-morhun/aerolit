<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

import AppShell from '@/components/layout/AppShell.vue';
import { useThemeStore } from '@/stores/theme';

const theme = useThemeStore();
let stopFollowingSystem: (() => void) | undefined;

onMounted(() => {
  stopFollowingSystem = theme.followSystem();
});

onBeforeUnmount(() => stopFollowingSystem?.());
</script>

<template>
  <a class="aq-skip-link" href="#main">Skip to content</a>
  <AppShell>
    <RouterView />
  </AppShell>
</template>
