# Aerolit — Berlin Particulate Monitoring

Operator dashboard for a network of 240 low-cost air-quality sensors across
Berlin, built for the Wised frontend home assignment.

**Vue 3 · TypeScript · Vite · PrimeVue · Leaflet · ECharts**

> **The reasoning behind this is in [`NOTES.md`](NOTES.md)** — trade-offs,
> assumptions, what I left out and where I disagreed with my tools. Individual
> decisions are written up as ADRs in [`docs/adr/`](docs/adr/).
>
> The original assignment brief is preserved at
> [`docs/assignment-brief.md`](docs/assignment-brief.md) and
> [`frontend/README.md`](frontend/README.md).

---

## Running it

Requires Node ≥ 20.19 (`.nvmrc` pins 24).

```bash
cd frontend
npm install
npm run dev:full     # mock API on :8787 + Vite on :5173
```

Then open <http://localhost:5173>.

To run the two processes separately:

```bash
npm run mock-api     # http://localhost:8787
npm run dev          # http://localhost:5173
```

The app talks to a same-origin `/api` prefix that Vite proxies to the mock
server, so there is no CORS setup and no environment file to fill in.

## Screenshots

| | Light | Dark |
| --- | --- | --- |
| **Dashboard** | ![Dashboard, light theme](docs/screenshots/dashboard-light.png) | ![Dashboard, dark theme](docs/screenshots/dashboard-dark.png) |
| **Sensor List** | ![Sensor list, light theme](docs/screenshots/sensor-list-light.png) | ![Sensor list, dark theme](docs/screenshots/sensor-list-dark.png) |

Both pages hold up from 2560 px down to a 768 px iPad in either orientation.
No interaction depends on hover. Below 768 px there is no phone layout — the
brief does not ask for one — but the shell still fits both tabs and neither
page scrolls sideways down to 320 px.

## What's implemented

**Dashboard** (`/dashboard`) — four KPI tiles with **real week-over-week trend
badges** (not placeholders), an OpenStreetMap sensor map with AQI-coloured
markers and a PM2.5/PM10 toggle, a persisted district watchlist with 24-hour
sparklines, and a full-width PM10-bars / PM2.5-line chart over 24H, 7D or 30D. The window
trails the snapshot hour while the bars are cut on the Berlin clock, which is
two decisions rather than one — [ADR 0010](docs/adr/0010-chart-windows-and-buckets.md)
says why. Selecting a station anywhere — map marker, watchlist row — loads it
into the chart.

**Sensor List** (`/sensors`) — the network as a sortable table, cursor-paginated
in both directions with controls that disable exactly when the API omits the
corresponding cursor. Typing a search, or sorting by a measured column, switches
the table to a mode that can answer that question across the whole network; the
footer says which mode is active. See [ADR 0006](docs/adr/0006-table-pagination-search-sort.md).

**Throughout** — light and dark themes from one token set, covering map tiles
and chart palette, surviving a reload and defaulting to the OS preference.

## How it's put together

```
frontend/src/
  api/          typed client — the only place that knows URLs and wire formats
  domain/       pure functions: AQI, stability, connection, KPIs, trends,
                bucketing, axis labelling, sorting. No Vue, no I/O, no
                ambient clock.
  queries/      TanStack Query composables — caching and request lifecycle
  stores/       Pinia — theme, selection, watchlist (UI state only)
  components/   ui/ = shared elements on top of PrimeVue · layout/ = app shell
  features/     dashboard/ and sensors/ compositions
  pages/        route targets
  theme/        design tokens + the PrimeVue preset that consumes them
```

Dependency direction is `pages → features → (ui, queries, stores) → (api,
domain)`, and `domain/` depends on nothing. That boundary is enforced by ESLint,
not convention — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Scripts

| Command | |
| --- | --- |
| `npm run dev` / `dev:full` | Vite dev server, alone or with the mock API |
| `npm run build` | Type-check, then production build |
| `npm run test` / `test:coverage` | Vitest; coverage gates the domain and API layers |
| `npm run test:e2e` | Playwright, desktop + iPad (first run: `npx playwright install chromium`) |
| `npm run test:all` | The whole gate: lint → types → unit → e2e |
| `npm run lint` / `format` | ESLint (zero warnings allowed) · Prettier |
| `npm run typecheck` | `vue-tsc` across app, tests and config projects |

## Tests

**177 Vitest + 75 Playwright**, all green (33 browser tests run at desktop and
at iPad width, plus 9 that only make sense at phone width).

```bash
cd frontend
npm run test                        # unit, component and integration
npx playwright install chromium     # once
npm run test:e2e                    # browser, desktop + iPad
```

Four layers, each answering a different question:

| Layer | What it proves |
| --- | --- |
| **Unit** (`src/**/*.spec.ts`) | The domain functions are right at their boundaries — AQI band edges, missing hours, the offline rule, nulls-last sorting. |
| **Dataset** ([`tests/dataset.spec.ts`](frontend/tests/dataset.spec.ts)) | The *definitions* are right. The domain layer runs against the real shipped data and is pinned to figures computed independently, so redefining the stability window fails a test instead of quietly producing a plausible wrong dashboard. |
| **Integration** (`tests/*.spec.ts`, MSW) | The pages wire up — real router, store and query client, stubbed network. |
| **End-to-end** (`e2e/`, Playwright) | The whole thing works against the **real mock API**: the cursor round-trip, the map and chart rendering, the theme surviving a reload. Runs at 1512 px and at 768 px, and includes an `axe-core` accessibility pass over both pages in **both themes**. |

CI runs all of it: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
