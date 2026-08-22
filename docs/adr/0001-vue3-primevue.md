# ADR 0001 — Vue 3 + PrimeVue over React + PrimeReact

**Status:** accepted · 2026-08-22

## Context

The brief allows either Vue 3 + PrimeVue or React + PrimeReact, both equally
welcome. I work in both stacks (React/Next.js at GRX, Vue at
EZCLOUD/Scanly).

## Decision

Vue 3 with `<script setup>` + TypeScript, PrimeVue v4.

## Rationale

- PrimeVue is PrimeTek's flagship: its v4 design-token theming
  (`definePreset`, styled mode) is more mature than PrimeReact's equivalent,
  and the brief's "light and dark from one set of design tokens" maps onto it
  directly.
- Composition API composables give a clean home for the derived-data layer
  (readings → KPI/AQI/stability) without extra abstraction.
- Vue's SFC scoping keeps the shared-component contract ("one edit point")
  easy to enforce.

## Considered and rejected

- **React + PrimeReact** — equally viable; rejected because PrimeReact's
  theming story is a step behind PrimeVue v4 tokens, which are central to
  this brief.
- **Nuxt** — SSR/file routing adds surface with zero payoff for a two-page
  SPA against a local mock API.
