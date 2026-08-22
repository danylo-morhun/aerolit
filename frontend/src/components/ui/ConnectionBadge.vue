<script setup lang="ts">
import { computed } from 'vue';

import { formatPercent } from '@/domain/format';
import type { ConnectionState } from '@/domain/types';

const props = defineProps<{
  state: ConnectionState;
  /** 0–1 share of expected readings actually reported. */
  stability: number;
}>();

const LABELS: Record<ConnectionState, string> = {
  hq: 'HQ link',
  poor: 'Poor link',
  offline: 'Offline',
};

const label = computed(() => LABELS[props.state]);
const percent = computed(() => formatPercent(props.stability));

/**
 * The dot is decorative; the state is already in the text. Screen readers get
 * one unambiguous sentence instead of a colour they cannot see.
 */
const srLabel = computed(() => `Connection: ${label.value}, ${percent.value} stability`);
</script>

<template>
  <span :class="['link', `link--${state}`]">
    <span class="link__dot" aria-hidden="true" />
    <span aria-hidden="true">{{ label }} {{ percent }}</span>
    <span class="sr-only">{{ srLabel }}</span>
  </span>
</template>

<style scoped>
.link {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: var(--aq-text-xs);
  font-weight: 500;
  white-space: nowrap;
}

.link__dot {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
}

.link--hq {
  color: var(--aq-link-hq);
}

.link--poor {
  color: var(--aq-link-poor);
}

.link--offline {
  color: var(--aq-link-offline);
}
</style>
