# Architecture

> Status: living document. Written before the first line of app code as the
> build contract; updated as implementation lands. Decision rationale lives in
> [`docs/adr/`](adr/), trade-off narrative in [`NOTES.md`](../NOTES.md).

## Overview

Two pages behind a shared app shell, one data source (the mock API on
`:8787`), one set of design tokens driving both themes.

```
┌───────────────────────────── App Shell ─────────────────────────────┐
│  top bar · tab nav (Dashboard | Sensor List) · theme toggle         │
├──────────────────────────────────────────────────────────────────────┤
│  DashboardPage                     │  SensorListPage                 │
│  ├─ KpiRow (4 × StatTile)          │  └─ SensorTable                 │
│  ├─ SensorMap ─┐ selection         │     · cursor pagination         │
│  ├─ DistrictWatchlist ─┤           │     · per-row enrichment        │
│  └─ ConcentrationChart ◄┘          │                                 │
└──────────────────────────────────────────────────────────────────────┘
```

## Layers

| Layer | Path | Rule |
| --- | --- | --- |
| API client | `src/api/` | The only place that knows URLs and DTO shapes. Typed, no business logic. |
| Domain | `src/domain/` | Pure functions only — AQI classification, stability, connection state, KPI roll-ups, week-over-week trends, series downsampling. No Vue imports, no I/O. Fully unit-tested. |
| Queries | `src/queries/` | TanStack Query composables — caching, deduplication, request lifecycle. Bridge between API and views. |
| Stores | `src/stores/` | Pinia, UI state only: theme, station selection, watchlist. Server data never lives here. |
| Shared UI | `src/components/ui/` | Project-level components on top of PrimeVue primitives (AppButton, DataGrid, StatTile, TrendBadge, AqiBadge, ConnectionBadge, Sparkline, WatchStar, …). A design change propagates from one edit point. **This is the only layer allowed to import `primevue/*`** — enforced by ESLint. |
| Features | `src/features/` | Page-specific compositions (dashboard/, sensors/). May use shared UI + queries + domain; never call `fetch` directly. |
| Pages | `src/pages/` | Route targets. Layout only. |
| Theme | `src/theme/` | One PrimeVue preset + design tokens; dark mode via a `.dark` selector on `<html>`. |

Dependency direction: `pages → features → (ui, queries, stores) → (api, domain)`.
`domain/` depends on nothing.

## Data flow

- **Snapshot time.** The dataset is fixed; "now" is the most recent hour
  present in the data, not `Date.now()`. Every window (24h, 168h, 30d) is
  anchored to it.
- **Dashboard.** Needs the whole network (map markers, KPI roll-ups):
  `/stations?limit=100` ×3 pages, then one `/readings?range=30d` per station,
  fetched through a query cache keyed by station id. Everything time-based is
  derived client-side from that one series per station: current PM2.5/PM10,
  AQI, offline check, stability %, 24h sparkline, KPI aggregates and their
  week-over-week deltas (reference point = now − 168h). See ADR 0005.
- **Sensor List.** Strictly cursor-driven (`after` / `before`), one page at a
  time; readings are fetched only for the rows currently on screen. The list
  is never pre-walked into a client-side copy. Search/sort semantics:
  ADR 0006.
- **Selection.** Map marker, watchlist row and table all set the same selected
  station (Pinia); the chart reads it. Selecting a station whose series is
  already cached renders the chart without a network round-trip.

## Derived values (single definitions, `src/domain/`)

| Value | Definition |
| --- | --- |
| AQI category | PM2.5: Good 0–12 · Moderate 12–35 · Elevated 35–55 · Unhealthy 55+ (µg/m³) |
| Stability % | readings present ÷ hours expected over the trailing 30 d (720) |
| Connection | Offline = no reading in the most recent expected hour; else Poor < 86 %, HQ ≥ 86 % |
| KPI trend | KPI(now) − KPI(now − 168 h), in the KPI's own unit; badge colour encodes better/worse, not sign |

## Theming

One token set (PrimeVue v4 preset) is the single source for both themes.
Dark mode toggles a class on the root element; the map swaps CARTO
light/dark base tiles and the chart reads its palette from the same CSS
variables. Default follows `prefers-color-scheme`; an explicit user choice is
persisted and wins.

## Testing strategy

Four layers, each answering a different question:

- **Unit** — `domain/` at its boundaries (band edges, missing hours, offline
  edge cases, downsampling, nulls-last sorting), plus component tests for every
  state of the shared badges and tiles.
- **Dataset** (`tests/dataset.spec.ts`) — the domain layer against the real
  shipped data, pinned to independently computed figures. This is what catches
  a wrong *definition*, which a fixture-based unit test cannot.
- **Integration** (`tests/*.spec.ts`) — the two pages with the real router,
  store and query client, network stubbed by MSW.
- **End-to-end** (`e2e/`, Playwright) — the app against the real mock API at
  1512 px and 768 px, including an axe accessibility pass over both pages in
  both themes.

Coverage thresholds gate `domain/` and `api/`; views are thin by construction
and are covered through the integration and e2e layers instead.
