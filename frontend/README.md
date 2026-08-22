# Air Quality Monitoring Dashboard

**Frontend Home Assignment**

Build a web app for a network of low-cost particulate sensors (PM2.5 / PM10)
deployed across Berlin: two pages behind a shared app shell, in a light and a
dark theme. Each section below describes the purpose and expected features of one
UI component; the mockups are the reference for the rest.

Before you start, read [What We're Looking For](../README.md#what-were-looking-for)
and the section on AI that follows it: we assess the reasoning behind the code at
least as much as the finished screens, and we'll go through your decisions with
you. Capture them in a `NOTES.md` as you go.

## Constraints

The following technologies are required. Any additional libraries are at your
discretion.

| Technology                | Purpose                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| **Vite**                  | Build tooling.                                                       |
| **Vue 3** or **React**    | Framework — your choice, both are equally welcome.                   |
| **PrimeVue / PrimeReact** | UI component library — whichever matches the framework you picked.   |
| **OpenStreetMap**         | Map tiles, via Leaflet or an equivalent wrapper for your framework.  |
| **Chart library**         | Your choice (e.g. Chart.js, Apache ECharts, ApexCharts).             |

All shared UI elements (buttons, inputs, cards, badges, etc.) must be implemented
as dedicated project-level components sitting on top of the PrimeVue /
PrimeReact primitives. Any design change to a shared element should propagate
across the entire interface from a single edit point, with no need to touch
individual views. Light and dark come from one set of design tokens.

## Viewports

- **Desktop**, 16:9 / 16:10, ~1280×800 to 2560×1440 — the layout in the mockups.
- **iPad**, both orientations (down to ~768 px wide).

No phone layout is required, and there is no mockup for tablet sizes — that
adaptation is your call. No interaction may depend on hover alone.

## Data

The sample dataset (240 Berlin stations) lives in [`mock-data/`](mock-data/) and
is served by a tiny zero-dependency Node mock API. Start it with:

```
node frontend/mock-data/server.mjs      # http://localhost:8787
```

Consume the dashboard's data through these endpoints. All values are for
**Berlin** and in **µg/m³**.

- **`GET /stations?limit=20&after=<cursor>`** (or **`&before=<cursor>`**) — the
  station list, **cursor paginated in both directions**. Each response is
  `{ items: [...], pageInfo: { after?, before? } }`, where every station carries
  only its static identity: `id`, `district`, `location`, and map `coordinates`
  (`lat`/`lng`). `pageInfo.after` and `pageInfo.before` are opaque cursors: pass
  `after` back as `?after=` for the next page, `before` as `?before=` for the
  previous one. Each is **omitted when there is no page in that direction** (so a
  first page has no `before`, the last has no `after`). There is no page-number /
  offset access by design.
- **`GET /stations/count`** — `{ total }`, for the network-wide KPI.
- **`GET /stations/:id/readings?range=24h|7d|30d`** — a station's 30-day series
  of PM2.5 / PM10 readings, `[{ t, pm25, pm10 }, …]`, oldest first (`range`
  optional). This is the single source of truth for everything time-based: derive
  the current PM2.5 / PM10 / AQI, the 24-hour sparkline, and the 24H / 7D / 30D
  chart ranges from it. **A healthy station reports one reading per hour, on the
  hour.** A fully reliable station therefore has 720 readings over 30 days;
  missing hours are dropped submissions, and the share present vs. expected is
  its **stability %**.
- **`GET /stations/:id/readings/count?from=<ISO>&to=<ISO>`** (or
  **`&range=24h|7d|30d`**) — `{ count }`, the number of readings a single
  station reported within `[from, to]` (inclusive; every bound optional). A
  convenience over `/readings` when you only need the tally for a window — e.g. a
  station's **stability %** over a range is `count / expected hours`, without
  pulling the full series. It is **per-station only**; there is no network-wide
  roll-up.

The data is a fixed snapshot (no live updates); you do not need to poll or
mutate it. The underlying JSON files are in `mock-data/` for reference.

## Connection

One state per station, derived from its readings. The snapshot's most recent hour
is "now".

- **Offline** — no reading for the most recent expected hour, whatever the
  stability %.
- **Poor link** — reporting, stability below 86%.
- **HQ link** — reporting, stability 86% or better.

## 1 · Overview

Reference views at desktop width, in both themes.

| Light | Dark |
| ----- | ---- |
| ![Dashboard](dashboard.png) | ![Dashboard, dark theme](dashboard_dark.png) |
| ![Sensor list](sensors-list.png) | ![Sensor list, dark theme](sensors-list_dark.png) |

## 2 · App Shell

Persistent top bar: product name, tab nav between **Dashboard** and **Sensor
List**, theme toggle. Each page has its own URL. The theme covers the whole
interface — map tiles and chart included — and survives a reload.

## 3 · Header

Page title on the left; search field on the right for lookup by district name or
sensor ID.

## 4 · KPI Tiles

Dashboard only. Four summary cards giving an immediate read on network state:
Active Sensors (not offline), Avg PM2.5, Poor Connection (poor link), Network
Stability (mean stability % across the network).

Each tile also carries a **trend badge** — the small `+6` / `-2.4` / `+16` /
`+0.8` indicator in the mockups. It is the KPI's **week-over-week change**: its
value now minus its value one week (168 h) earlier, in the KPI's own unit (a
count, a µg/m³ figure, or a percentage-point move — not a percentage). The
badge's colour reflects whether the movement is good or bad, not merely its
sign: Avg PM2.5 falling and Network Stability rising both read as an improvement,
while more Poor Connections reads as a regression.

There is no network-wide aggregate endpoint for this — each KPI is still yours to
roll up across the network. What the API does give you is a per-station
`GET /stations/:id/readings/count?from=&to=` (see §Data), which turns a single
station's stability % over any window into a one-call lookup instead of a
full-series pull. Derive the badges from that plus the `/readings` series: each
station carries 30 days of hourly history, so the "one week ago" figure is
recoverable by taking now − 168 h as the reference point and recomputing each KPI
there. It is still a heavier computation than the live number — it touches every
station — so if you judge it out of scope for the time you have, note the
assumption in your `NOTES.md` and treat the badge as a static placeholder. The
intended reading is a real week-over-week delta.

## 5 · Sensor Map

Geographic overview of the sensor network. One marker per station, colour-coded
by AQI (green through red). Includes a PM2.5 / PM10 pollutant toggle; selecting a
marker updates the chart below.

The Air Quality Index legend:

- **Good** · 0–12
- **Moderate** · 12–35
- **Elevated** · 35–55
- **Unhealthy** · 55+

## 6 · Districts

Dashboard side panel: a short watchlist of tracked stations, not the full
network. Each row shows district, sensor ID and location, live PM2.5 with AQI
badge, 24-hour sparkline, PM10, connection state and stability %. Clicking a row
loads the station into the chart; **View all** goes to the Sensor List.

## 7 · Particulate Concentration Chart

Full-width time-series chart for the selected station. PM10 rendered as bars,
PM2.5 as an overlaid line, on a shared time axis. Range selector: 24H / 7D / 30D.

## 8 · Sensor List

The full station network as a table: **ID · District · Neighborhood
(`location`) · PM2.5 · PM10 · AQI · Connection**. Sortable by column; the
header's search filters it.

The collection is **cursor-paginated** (`GET /stations`, see §Data). Load it one
page at a time by following the cursors in `pageInfo` — forward with `after`,
backward with `before` — using next/previous controls (or infinite scroll, or
equivalent), showing a loading state and disabling navigation whenever the
corresponding cursor is absent. Do **not** walk every page up front to build one
big client-side list.
