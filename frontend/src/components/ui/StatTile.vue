<script setup lang="ts">
import TrendBadge from './TrendBadge.vue';

/**
 * One KPI card: icon, week-over-week badge, headline figure, caption.
 *
 * The tile owns layout and nothing else — the value arrives pre-formatted and
 * the delta pre-computed, so the same component serves a count, a
 * concentration and a percentage without knowing what any of them mean.
 */
withDefaults(
  defineProps<{
    label: string;
    /** Already formatted for display. */
    value: string;
    unit?: string;
    icon: string;
    tone?: 'accent' | 'good' | 'bad' | 'neutral';
    delta?: number | null;
    higherIsBetter?: boolean;
    deltaFractionDigits?: 0 | 1;
    deltaUnitLabel?: string;
    loading?: boolean;
  }>(),
  {
    unit: '',
    tone: 'neutral',
    delta: null,
    higherIsBetter: true,
    deltaFractionDigits: 1,
    deltaUnitLabel: '',
    loading: false,
  },
);
</script>

<template>
  <article class="tile">
    <div class="tile__top">
      <span :class="['tile__icon', `tile__icon--${tone}`]" aria-hidden="true">
        <i :class="icon" />
      </span>
      <TrendBadge
        v-if="!loading"
        :delta="delta"
        :higher-is-better="higherIsBetter"
        :fraction-digits="deltaFractionDigits"
        :unit-label="deltaUnitLabel"
      />
    </div>

    <p class="tile__value">
      <span v-if="loading" class="tile__skeleton" aria-hidden="true" />
      <template v-else>
        {{ value }}<span v-if="unit" class="tile__unit">{{ unit }}</span>
      </template>
    </p>

    <p class="tile__label">{{ label }}</p>
  </article>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  gap: var(--aq-space-2);
  min-width: 0;
  padding: var(--aq-space-5);
  background: var(--aq-surface);
  border: 1px solid var(--aq-border);
  border-radius: var(--aq-radius-xl);
  box-shadow: var(--aq-shadow-card);
}

.tile__top {
  display: flex;
  gap: var(--aq-space-3);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--aq-space-3);
}

.tile__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  font-size: 15px;
  border-radius: var(--aq-radius-md);
}

.tile__icon--accent {
  color: var(--aq-c-elevated);
  background: var(--aq-status-elevated-bg);
}

.tile__icon--good {
  color: var(--aq-c-good);
  background: var(--aq-status-good-bg);
}

.tile__icon--bad {
  color: var(--aq-c-unhealthy);
  background: var(--aq-status-unhealthy-bg);
}

.tile__icon--neutral {
  color: var(--aq-status-neutral-fg);
  background: var(--aq-status-neutral-bg);
}

.tile__value {
  display: flex;
  gap: 4px;
  align-items: baseline;
  font-size: var(--aq-text-2xl);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.tile__unit {
  font-size: var(--aq-text-base);
  font-weight: 500;
  color: var(--aq-ink-muted);
}

.tile__label {
  font-size: var(--aq-text-sm);
  color: var(--aq-ink-muted);
}

.tile__skeleton {
  display: inline-block;
  width: 4ch;
  height: 1em;
  background: var(--aq-surface-sunken);
  border-radius: var(--aq-radius-sm);
}
</style>
