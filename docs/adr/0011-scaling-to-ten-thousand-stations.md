# ADR 0011 — What changes at 10 000 stations

**Status:** accepted · 2026-08-23

## Context

The brief opens by saying the network is "roughly 10,000" stations, and ships a
sample of 240. The dashboard's whole derived state is computed client-side from
one 30-day series per station (ADR 0005), which is honest at the size given and
is the wrong shape at the size named.

This ADR is not a plan to build that today. It is the answer to "did you think
about scale, or did you just fit the sample?", written before the question is
asked, and it is what decides which work belongs in the submission and which
does not.

## What the numbers actually say

Measured against the shipped dataset:

| | 240 stations | 10 000 stations |
| --- | --- | --- |
| Series payload | 9.2 MB | **382 MB** |
| Readings | 172 560 | 7 190 000 |
| Identity index | 41 kB | 1.7 MB |
| Requests to load the dashboard | 3 + 240 | 3 + 10 000 |

Two things follow, and they point in different directions.

**The series are the wall.** 382 MB and ten thousand requests is not a client's
job at any level of cleverness — no pool size, no cache policy and no rendering
technique moves that figure. This is the only thing that has to change.

**The identity index is not.** 1.7 MB of `id`, `district`, `location` and
coordinates is a large-ish JSON file, not a crisis. The map would want spatial
paging for rendering reasons, but the index itself is affordable.

There is a third figure, and it is the one that decides this is not a
someday problem. The roll-up is a synchronous pass over every reading, and a
long-task observer measures it at **595 ms** on one continuous task at 240
stations — already a visible freeze on a phone, already long enough that a tap
landing inside it is dropped. It scales with the data, so the same pass at
10 000 stations is roughly half a minute of a wedged main thread. No amount of
`requestIdleCallback` makes that acceptable; the reduction has to happen
somewhere else.

## Decision

The reduction moves to the server; the client renders.

- **`GET /kpis?at=`** — the four network-wide figures, and the same call at
  `at = now − 168 h` for the trend badges. Today `rollUpNetwork` walks every
  station twice to produce exactly this.
- **`GET /stations?bbox=&zoom=`** — the markers in view, clustered above a zoom
  threshold. One marker per station stops being meaningful long before 10 000
  of them overlap Berlin.
- **`GET /stations?sort=&after=`** — server-side ordering, which removes the
  reason the sensor table has a second mode at all (ADR 0006). Search and sort
  become cursor queries like any other.
- **`GET /stations/:id/readings`** stays exactly as it is. One station's history
  is a per-station question and always was.

## What changes, and what does not

The point of the layering is that this is a short list.

**Changes** — four files, all of them the ones whose job is fetching:

| File | Change |
| --- | --- |
| `src/api/stations.ts` | Three new endpoints alongside the existing ones |
| `src/queries/useNetwork.ts` | Reads `/kpis` instead of reducing 10 000 series |
| `src/queries/useSensorTable.ts` | Loses the `search` mode; every question is a cursor query |
| `src/features/dashboard/SensorMap.vue` | Markers follow the viewport; clusters above a zoom |

**Does not change** — the 13 modules and 1 004 lines of `src/domain/` (plus the
841 lines of tests that come with them), every shared component in
`src/components/ui/`, the stores, the theme, the router, and the pages, which
read the same `NetworkView` shape whoever computed it.

The domain layer is the part worth dwelling on: it is pure by contract, with the
snapshot instant passed in as `at` and no ambient clock, no Vue and no I/O —
enforced by ESLint rather than by convention. Those functions do not get ported
to the server. They *move*, unchanged, and the same `computeKpis` then produces
the figure behind `/kpis?at=`. That is the return on drawing the boundary where
it is drawn, and it is the reason this ADR is four files long instead of a
rewrite.

## Where virtualisation fits

It is a consequence of this migration, not a precursor to it — measured and
recorded in ADR 0006. Today a page is twenty rows, all 240 matches render in
10.6 ms, and the window bounds *requests* rather than DOM nodes, because each
visible row fetches its own series.

Once ordering is served and rows arrive already carrying their measurements, a
page stops being twenty rows, and infinite scroll over the cursor stream with a
virtualised viewport becomes the right control. Doing it now would cost a fixed
row height — which means truncating the neighbourhood column — in exchange for
saving eleven milliseconds, and would leave the 382 MB untouched while looking
like scale work had been done.

## Considered and rejected

- **Fetch the series lazily, only for stations in view.** Fixes the map and
  breaks the KPIs: "mean stability across the network" is not a viewport
  question, and computing it from what happens to be on screen would produce a
  number that changes when you pan.
- **Keep the roll-up client-side, add a web worker.** Moves 382 MB off the main
  thread without making it smaller. The download is the problem, not the
  arithmetic.
- **Precompute a network summary into a static file.** Works until "now" needs
  to be a parameter — the trend badges already ask for the same roll-up at
  `now − 168 h`, and a static summary cannot answer an arbitrary `at`.
- **Do nothing and note it.** What the submission would have done if the
  boundary had not already been drawn; the point of writing this down is that
  the answer is four files rather than a rewrite.
