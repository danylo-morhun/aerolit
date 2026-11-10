# aerolit-air-quality-dashboard

operator dashboard for a network of 240 air quality sensors in Berlin.
it was built as a frontend home assignment for Wised.

the reasoning behind it, with trade-offs, assumptions and what was left out, is in
[NOTES.md](NOTES.md). single decisions are written up as ADRs in [docs/adr/](docs/adr/).
the original brief is in [docs/assignment-brief.md](docs/assignment-brief.md).

## screenshots

| page        | light                                                               | dark                                                              |
| :---------- | :------------------------------------------------------------------ | :---------------------------------------------------------------- |
| dashboard   | ![dashboard, light theme](docs/screenshots/dashboard-light.png)     | ![dashboard, dark theme](docs/screenshots/dashboard-dark.png)     |
| sensor list | ![sensor list, light theme](docs/screenshots/sensor-list-light.png) | ![sensor list, dark theme](docs/screenshots/sensor-list-dark.png) |

| dashboard on a phone                                          | sensor list on a phone                                            |
| :------------------------------------------------------------ | :---------------------------------------------------------------- |
| ![dashboard on a phone](docs/screenshots/phone-dashboard.png) | ![sensor list on a phone](docs/screenshots/phone-sensor-list.png) |

## pages

the dashboard at `/dashboard` has four KPI tiles with week-over-week trends, a map
of the sensors colored by AQI with a PM2.5 and PM10 switch, a saved watchlist of districts
with 24-hour sparklines, and a chart of PM10 and PM2.5 over 24 hours, 7 days or 30 days.
selecting a station on the map or in the watchlist loads it into the chart.
the selection is kept in the URL, so a view survives a reload and can be shared.

the sensor list at `/sensors` is a sortable table with cursor pagination in both directions.
searching, or sorting by a measured value, switches the table to a mode that covers the whole
network, and the footer says which mode is on. on a phone the table turns into one card
per station.

both pages have light and dark themes from one set of tokens, including map tiles and charts.
the layout works from 2560px down to a phone, and nothing depends on hover.

## structure

```
frontend/src/
  api/         typed client, the only place that knows URLs and response formats
  domain/      pure functions: AQI, stability, KPIs, trends, bucketing, sorting
  queries/     TanStack Query composables
  stores/      Pinia stores for UI state: theme, selection, watchlist
  components/  shared UI on top of PrimeVue and the app shell
  features/    dashboard and sensor list
  pages/       route targets
  theme/       design tokens and the PrimeVue preset
```

dependencies go from pages to features, then to components, queries and stores,
then to api and domain. `domain/` depends on nothing, and ESLint enforces that.
[ADR 0011](docs/adr/0011-scaling-to-ten-thousand-stations.md) shows what changes
for a network of 10,000 stations: only the four files that fetch data.

## stack

Vue 3, TypeScript, Vite, PrimeVue, TanStack Query, Pinia, Leaflet, ECharts.

## run locally

requires Node 20.19 or later. `.nvmrc` pins Node 24.

```bash
cd frontend
npm install
npm run dev:full
```

this starts the mock API on port 8787 and Vite on port 5173. the app calls `/api`,
which Vite proxies to the mock server, so there is no CORS setup and no env file.

| command                 | what it does                                                                    |
| :---------------------- | :------------------------------------------------------------------------------ |
| `npm run dev`           | Vite dev server without the mock API                                            |
| `npm run mock-api`      | mock API only                                                                   |
| `npm run build`         | type check and production build                                                 |
| `npm run test`          | Vitest                                                                          |
| `npm run test:coverage` | Vitest with coverage gates for domain and API                                   |
| `npm run test:e2e`      | Playwright on desktop, iPad in Chromium and WebKit, phone, and visual baselines |
| `npm run test:all`      | lint, type check, unit tests and e2e                                            |
| `npm run lint`          | ESLint with zero warnings allowed                                               |

before the first e2e run, install the browsers with `npx playwright install chromium webkit`.

## tests

| layer                            | what it checks                                                                                    |
| :------------------------------- | :------------------------------------------------------------------------------------------------ |
| unit, `src/**/*.spec.ts`         | domain functions at their edges: AQI bands, missing hours, the offline rule, sorting with nulls   |
| dataset, `tests/dataset.spec.ts` | runs the domain layer on the real data and compares it with figures computed separately in Python |
| integration, `tests/*.spec.ts`   | pages with the real router, stores and query client, and a stubbed network (MSW)                  |
| e2e, `e2e/`                      | the built app against the mock API at 1512px, 768px and 390px, with axe checks in both themes     |
| visual, `e2e/visual.spec.ts`     | pixel baselines of both pages in both themes. captured on macOS and skipped elsewhere             |

CI runs everything in [.github/workflows/ci.yml](.github/workflows/ci.yml).
