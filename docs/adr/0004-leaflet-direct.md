# ADR 0004 — Leaflet used directly behind a project component

**Status:** accepted · 2026-08-22

## Context

OpenStreetMap via Leaflet (or an equivalent wrapper) is required. Options:
`@vue-leaflet/vue-leaflet` bindings, or Leaflet's imperative API wrapped in
one project component.

## Decision

Raw Leaflet inside a single `SensorMap` component (map lifecycle in a
composable), no third-party Vue bindings. Base tiles: CARTO
`light_all` / `dark_all` (the basemap shown in the mockups), switched by the
active theme, with OSM/CARTO attribution.

## Rationale

- The map surface we need is small: one tile layer, ~240 circle markers,
  a click handler, a legend. Wrapping that ourselves is less code than the
  binding library's API surface, and there is no reactivity-vs-imperative
  impedance to debug.
- Marker colour comes from the same AQI classifier (`domain/aqi.ts`) as the
  badges — one definition of the palette.
- Circle markers are recreated from a computed list; at 240 items, diffing
  markers manually is premature optimisation.

## Considered and rejected

- **@vue-leaflet/vue-leaflet** — saves nothing at this scale and adds a
  dependency whose update cadence has been uneven.
- **MapLibre GL** — WebGL basemap is overkill for 240 static points and
  makes the required OSM tile sourcing less direct.
