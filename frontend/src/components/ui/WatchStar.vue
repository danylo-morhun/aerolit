<script setup lang="ts">
import { computed } from 'vue';

/**
 * Add/remove a station from the dashboard watchlist.
 *
 * Shared because the same control appears in two places with the same meaning
 * — filled in the watchlist panel, hollow-until-starred in the sensor table —
 * and because the pair has to stay in step: the watchlist's empty state tells
 * the operator to star something in the list, so the list has to offer it.
 */
const props = withDefaults(
  defineProps<{
    watched: boolean;
    /** True when the watchlist is at capacity and this row isn't on it. */
    disabled?: boolean;
    /** e.g. "Mitte BLN-0001" — makes the action's target explicit for AT. */
    stationLabel: string;
  }>(),
  { disabled: false },
);

defineEmits<{ toggle: [] }>();

const label = computed(() => {
  if (props.watched) return `Stop tracking ${props.stationLabel}`;
  if (props.disabled)
    return `Watchlist is full — remove a station before adding ${props.stationLabel}`;
  return `Track ${props.stationLabel}`;
});
</script>

<template>
  <button
    type="button"
    class="star"
    :class="{ 'star--on': watched }"
    :aria-pressed="watched"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    @click="$emit('toggle')"
  >
    <i :class="watched ? 'pi pi-star-fill' : 'pi pi-star'" aria-hidden="true" />
  </button>
</template>

<style scoped>
.star {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  font-size: 13px;
  color: var(--aq-ink-subtle);
  cursor: pointer;
  background: none;
  border: 0;
  border-radius: var(--aq-radius-sm);
  transition: color var(--aq-transition);
}

.star:hover:not(:disabled) {
  color: var(--aq-accent-text);
  background: var(--aq-surface-sunken);
}

.star--on {
  color: var(--aq-accent-text);
}

.star:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
