# ADR 0003 — TanStack Query for server state, Pinia for UI state

**Status:** accepted · 2026-08-22

## Context

The dashboard needs per-station readings for the whole network (240 series);
the table needs per-page enrichment; the chart re-reads series already
fetched by the map/KPIs. That is a caching and deduplication problem, not a
"global store" problem.

## Decision

- `@tanstack/vue-query` owns everything fetched: station pages, per-station
  series, counts. Cache key = endpoint + params (e.g. `['readings', id]`).
- Pinia owns the little true UI state: theme, selected station, pollutant,
  watchlist ids. Server data never enters Pinia.

## Rationale

- Selecting a station on the map after the dashboard load renders the chart
  from cache — zero refetch — because the same query key was already
  populated. Hand-rolling that cache is exactly the code most likely to hide
  bugs.
- Request lifecycle (loading/error/retry/abort-on-unmount) comes with the
  library and is visible in the table's pagination states.
- The separation gives a one-line answer to "why does this state live here":
  fetched → query cache; chosen by the user → Pinia; derived → computed from
  the other two, never stored.

## Considered and rejected

- **Pinia for everything** — turns a store into a hand-written cache with
  staleness and dedup logic; more code to defend, less standard.
- **Plain composables + module-level Map cache** — workable and
  dependency-free, but re-implements the uninteresting 20 % of TanStack Query
  and none of its devtools/observability.
