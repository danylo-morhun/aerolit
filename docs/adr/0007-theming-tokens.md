# ADR 0007 — Theming: one PrimeVue v4 preset, dark via root class

**Status:** accepted · 2026-08-22

## Context

Light and dark must come from one set of design tokens, cover the whole
interface including map tiles and chart, and survive a reload. Shared UI
elements must restyle from a single edit point.

## Decision

- One custom preset built with `definePreset` on the Aura base:
  primitive → semantic → component tokens. No per-view style overrides.
- Dark mode = `darkModeSelector: '.dark'`; the class is toggled on `<html>`.
- Default follows `prefers-color-scheme`; an explicit toggle choice is
  persisted to `localStorage` and takes precedence.
- Non-Prime surfaces consume the same tokens as CSS variables: ECharts
  palette/axes, the Leaflet container, AQI/connection badge colours.
  Map tiles switch between CARTO light/dark basemaps on the same signal.

## Rationale

- The token cascade is the mechanism the brief describes: change a semantic
  token once, every badge/tile/control follows — including the chart, because
  it reads CSS variables at render time rather than hardcoding a palette.
- Class-based dark (vs media-query-only) is what makes "toggle + persist"
  implementable while still honouring the OS default on first visit.

## Considered and rejected

- **Two stylesheets / unstyled mode + Tailwind** — a second styling system
  alongside Prime tokens is precisely the "per-view overrides" failure mode
  the brief warns about.
