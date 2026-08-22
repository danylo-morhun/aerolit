# ADR 0008 — Hand-rolled SVG sparkline

**Status:** accepted · 2026-08-22

## Context

Each watchlist row shows a 24-hour PM2.5 sparkline: 24 points, no axes, no
tooltip, colour = the row's AQI category.

## Decision

A small presentational `Sparkline.vue`: props `points: number[]` and a
semantic colour, renders one `<polyline>` (plus a soft area fill) in a
`viewBox`, normalised in ~20 lines of pure code.

## Rationale

- An ECharts instance per row is the heavyweight tool for a glyph: canvas
  contexts, resize observers and init cost ×N rows, to draw a line with no
  interactivity.
- SVG scales crisply with the row, inherits `currentColor` from the theme
  tokens, and the normalisation math is trivially unit-testable.

## Considered and rejected

- **ECharts per row** — cost without benefit at this size.
- **A "sparkline" micro-dependency** — 20 lines is below the threshold where
  a dependency pays for its supply-chain and update surface.
