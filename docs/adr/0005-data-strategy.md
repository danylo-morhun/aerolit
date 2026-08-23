# ADR 0005 — One 30-day series per station; all metrics derived client-side

**Status:** accepted · 2026-08-22

## Context

There is deliberately no network-wide aggregate endpoint. The dashboard needs
all 240 stations for the map and KPI roll-ups; the brief marks
`/stations/:id/readings` as "the single source of truth for everything
time-based". The dataset is a fixed snapshot: "now" is the most recent hour
in the data, not wall-clock time.

## Decision

On the dashboard, load the full station identity list (`/stations?limit=100`,
3 pages — legitimate here; the §8 prohibition targets the *table*), then
fetch `GET /stations/:id/readings` once per station through the query cache,
with bounded request concurrency. The `range` parameter is deliberately
omitted: the whole 30-day series is what every consumer needs between them,
and asking for it by name would imply the client could ask for less. Every derived value — current
PM2.5/PM10, AQI, offline state, stability %, 24 h sparkline, the four KPIs and
their week-over-week deltas — is computed in `src/domain/` from those series.

## Rationale

- One fetch per station serves the map, the KPIs, the sparklines *and* the
  chart's 30D range; selecting any station renders the chart from cache.
- One code path and one definition per metric, unit-testable in isolation,
  instead of stitching `/readings/count` results to partial series.
- Volume is bounded and known: 240 × 720 points ≈ a few MB against a local
  mock — acceptable; the NOTES discuss what changes at the advertised 10 000
  stations (server-side aggregation is the real answer; the exercise is
  explicit that the roll-up is ours to do).

## Considered and rejected

- **`range=7d` series + `/readings/count?range=30d` for stability** — halves
  payload but doubles request count (480), splits the source of truth for one
  station across two calls, and still can't serve the 30D chart from cache.
- **`/readings/count` for the table rows** — the table needs current values
  and AQI anyway, which require the series; the count endpoint alone never
  suffices. Where only stability is needed it remains the lighter tool, and
  the trade-off is recorded in NOTES.md.
- **Static placeholder trend badges** (explicitly permitted) — rejected; the
  data for the real week-over-week delta is already in cache, so the honest
  number costs little. Edge case: a 30 d stability window anchored at
  now − 168 h extends past the snapshot's start; stability there is computed
  over the hours actually observable (assumption recorded in NOTES.md).
