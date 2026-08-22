# NOTES

The reasoning behind the submission: what I decided, what I assumed where the
brief was silent, what I left out, and where I disagreed with my tools.

Decisions that needed room to breathe are written up as ADRs in
[`docs/adr/`](docs/adr/) — each records what I rejected as well as what I chose.
This file is the summary and the honest list of edges.

---

## 1 · The decisions I'd most want to defend

### The domain layer is pure, and that is enforced

Every derived number in the app — AQI category, stability %, connection state,
the four KPIs, the week-over-week deltas, the chart buckets — is computed by a
pure function in `src/domain/`. No Vue, no `fetch`, no `Date.now()`. It isn't a
convention: `eslint.config.ts` restricts imports and the ambient clock inside
that folder.

The clock rule is the one that matters. The dataset is a **fixed snapshot**, so
"now" is a property of the data (the most recent hour any station reported,
`2026-07-11T12:00Z`), not of when the page happens to be opened. A single hidden
`Date.now()` would make every metric drift as the exercise ages. Callers pass
the instant in; `deriveStationMetrics({ at })` is the same function whether it is
producing the live figure or the one from a week ago.

That last property is what makes the trend badges honest rather than decorative
— more on that below.

### Verifying the definitions, not just the functions

The unit tests use synthetic fixtures, which prove a function does what its name
says. They cannot prove the name describes the right thing.

So I computed the four KPIs independently — a throwaway Python pass over
`mock-data/` — and pinned those numbers in
[`frontend/tests/dataset.spec.ts`](frontend/tests/dataset.spec.ts): 223 active
sensors, 12.4413 µg/m³ mean PM2.5, 17 poor links, 0.9461 network stability, and
the week-over-week deltas −6 / +0.34 / −14 / +0.02 pp. Two implementations
written from the same spec agreeing to four decimals is much stronger evidence
than either alone. If someone later redefines the stability window or the
offline rule, that test fails instead of the dashboard quietly showing a
plausible wrong number.

### Real week-over-week badges, and the clamp that makes them true

The brief allows a static placeholder here. I built the real thing, because the
data is already in cache: the reference figure re-runs the same roll-up anchored
at `now − 168 h`.

Doing that surfaces a subtle trap. Stability is "readings present ÷ hours
expected" over a trailing 30 days. Anchored a week earlier, that window reaches
**168 hours before the dataset begins**. Scoring every station against 720 hours
when only 552 were ever observable drags the reference down to ≈0.725 and
invents a network-wide *+22 point recovery* that never happened.

So the expected count is clamped to the start of available history
(`stabilityAt`, `src/domain/stability.ts`). The two figures are then both
"share present ÷ hours that could have been observed", which is comparable. The
honest caveat: they are measured over windows of different lengths (720 h vs
552 h). The alternative — equal-length 7-day windows on both sides — would be
cleaner statistically but would stop matching the KPI actually displayed, which
the brief defines as a 30-day figure. I chose to match the displayed metric and
write the caveat down rather than silently change what the number means.

### Which stations feed which KPI

Two judgement calls the brief leaves open, both in `computeKpis`:

- **Avg PM2.5 counts reporting stations only.** An offline station's last
  reading can be hours old; folding it into a "current" average mixes stale air
  into a live number. Silence is already reported by the Active Sensors tile.
- **Network Stability counts every station, offline included.** It measures how
  dependable the network is at delivering data, and a sensor that stopped
  reporting is the strongest evidence of undependability. Excluding it would
  make the fleet's score *improve* as more of it failed.

### The table: cursor pagination versus search and sort

`GET /stations` is cursor-paginated with no server-side search or sort. The
brief asks for a sortable, searchable table and forbids walking every page up
front. For any sort key the server doesn't order by, those constraints conflict.

I read the prohibition as targeting bulk data hoarding, not the ~240-entry
identity index, and resolved it as **two modes** (`useSensorTable.ts`):

- **browse** (default) — one cursor page at a time, `after` / `before`, controls
  disabled exactly when the API omits the corresponding cursor. Readings are
  fetched per visible row.
- **search** — entered only when the operator types a query or sorts by a
  measured column, because those questions cannot be answered from twenty rows.
  A page-local sort by PM2.5 shows a per-page maximum, which is worse than no
  sort: it looks like an answer and isn't.

The mode is derived from what was asked, not chosen from a menu, and the footer
says which one is active.

Two details decide whether that boundary is principled or just convenient:

- **The server's order is `id` ascending — direction included.** Descending by
  id looks like a free reversal of the page, and isn't: page one reversed is
  stations 1–20 backwards, never 240–221. It switches mode like any other
  ordering the server doesn't serve.
- **Search mode fetches the identity index, not the network's readings.** 240
  identities is 3 requests and ~40 kB; the twenty rows on screen then fetch
  their own series, shared with the dashboard's cache. Only a sort **by a
  measured column** needs everything — you cannot know which twenty stations
  have the highest PM2.5 without looking at all 240 — and that is the one case
  that pays for it. Measured in the running app: text search 3 requests, sort by
  district 23, sort by PM2.5 243.

Rather than guess against the brief's "don't build one big client-side list", I
**asked Wised** which reading was intended (the question is quoted verbatim in
[ADR 0006](docs/adr/0006-table-pagination-search-sort.md), sent 22 Aug). No
answer had arrived by the time this was written, so the submission ships the
reading I argued for — and is structured so the strict one is a deletion: drop
the `search` branch, and `isServerOrder` returns true for every key. Nothing
else in the table changes.

### Accessibility caught a real defect in the design

The palette sampled from the mockups fails WCAG AA for small text — twelve
distinct violations, worst being Moderate amber at 2.1:1 on white where 4.5:1
is required. I found this by running `@axe-core/playwright` over both pages,
not by eye.

The fix splits the palette by role, along the line WCAG itself draws: graphics
(map markers, sparklines, chart series) need 3:1 and keep the mockup hues
exactly, because the vivid colour is what makes the map scannable; text needs
4.5:1 and uses a darkened variant of the same hue — the minimum darkening that
clears the threshold, hue and saturation preserved. Status text is therefore a
shade deeper than the comp. That is a deviation I would raise with the
designer rather than ship silently, and it is enforced rather than asserted:
axe runs in CI over both pages in **both themes**, so a future colour change
that breaks contrast fails the build. Full reasoning in
[ADR 0009](docs/adr/0009-accessible-palette.md).

### What became a shared component, and what didn't

`src/components/ui/` holds the elements that appear in more than one place with
identical meaning: `AppButton`, `AppCard`, `AqiBadge`, `ConnectionBadge`,
`TrendBadge`, `MetricChip`, `StatTile`, `Sparkline`, `SegmentedToggle`,
`SearchInput`, `WatchStar`, `DataGrid`, `StateBlock`. The AQI badge renders in
the watchlist and the table; changing its shape is one edit.

The boundary is enforced, not just described: ESLint forbids importing
`primevue/*` anywhere outside `src/components/ui/`, so a feature cannot quietly
reach past the wrapper layer. Table chrome lives in the theme preset's
`components.datatable` tokens rather than as `.p-datatable-*` rules inside the
component that happens to render a table — that is precisely the difference
the brief draws between "one set of tokens" and "per-view overrides".

What stayed local: the watchlist row, the KPI row's composition, the table's
column definitions. They look reusable but each exists once, and hoisting a
single-use layout into a "shared" component buys nothing while making the thing
harder to read.

`SearchInput` is shared; the *query state* is not. Each page owns its own,
because the two mean different things — narrowing the map and watchlist versus
filtering a table of every station. Hoisting the query into a store would have
coupled two behaviours that merely look alike.

### Theming from one place, including the parts that aren't DOM

`src/theme/tokens.css` is a two-tier token set (primitives → semantic roles).
The PrimeVue preset maps its component tokens onto `var(--aq-*)` rather than
duplicating literal colours under `colorScheme.light` / `.dark`, so one
definition covers both themes. ECharts and Leaflet can't read CSS variables from
canvas, so they read the computed values through `cssVar()` — same source, no
second palette. Dark mode swaps the CARTO basemap too; a bright map in a dark
dashboard is what gives away a half-finished theme.

The palette was sampled pixel-by-pixel from the provided mockups rather than
eyeballed.

---

## 2 · Assumptions where the brief was silent

| Assumption | Why |
| --- | --- |
| **"Now" = the latest hour across *all* stations** (2026-07-11T12:00Z) | 17 of 240 stations are offline; anchoring on any single station could shift the app's clock backwards and mark the offline ones healthy. |
| **AQI bands are `[from, to)`** | The brief writes "0–12" and "12–35", which overlap at 12. A reading of exactly 12 is Moderate. |
| **PM10 uses the PM2.5 bands, doubled** | The brief defines one scale and ties it to PM2.5, but the map has a PM10 mode that still needs marker colours. Reusing the PM2.5 bounds would paint nearly the whole network red. A real deployment would take these from the regulator. |
| **Offline stations keep their last known concentrations** | That is what the reference mockup shows (`Offline 86%` next to real PM values). `connection` communicates the silence. |
| **Missing hours are omitted from the sparkline, not zero-filled** | A zero draws the line to the floor and reads as clean air, when what happened is that nothing was reported. Same reasoning for chart gaps: `connectNulls: false`. |
| **Times display in Europe/Berlin** | The network is Berlin's and an 18:00 peak should land at 18:00. Pinning the zone also makes rendering identical on every machine, CI included. |
| **The watchlist seeds with four stations and is user-editable** | The brief says "a short watchlist… not the full network" without saying which. The star control makes it theirs; the choice persists in `localStorage`. |
| **Dashboard search narrows; list search filters** | On the dashboard the map and watchlist are one view of "the network right now", so the query narrows both. Exhaustive lookup belongs on the Sensor List. |
| **Fonts are bundled, not loaded from Google's CDN** | The mockup is clearly not set in a system font, but embedding Google Fonts sends the visitor's IP to the US without consent — held to breach the GDPR by a German court in 2022, which is not a footnote for a Berlin network run from the EU. Only the latin subset and the seven weights this UI uses are shipped: 112 kB. A system-font stack still backs them. |
| **The map card says "Particulate readings", where the mockup says "Real-time particulate readings"** | The dataset is a fixed snapshot the brief says not to poll. Calling it real-time would be the one piece of copy on the page that isn't true. |
| **Tablet layout** | No mockup was given. KPIs go 4→2 columns at 900 px; the map/watchlist split stacks at 1100 px, where the watchlist becomes two columns to use the width. Verified at 768 px and 1024 px in both orientations. |

---

## 3 · Where I traded completeness for time

- **The table's snapshot instant is derived from the rows on screen.** On the
  dashboard "now" is exact — every station is loaded. On the Sensor List it is
  the latest hour among the twenty visible rows, which lands on the true value
  unless an entire page is offline (17 of 240 are, so this is vanishingly
  unlikely, but it is not impossible). That is the price of not pulling 240
  series to render 20 rows. The clean fix is a network-wide `/snapshot`
  endpoint; inventing one felt out of scope.
- **No keyboard access to individual map markers.** 240 tab stops would be worse
  than none; keyboard and screen-reader users reach every station through the
  watchlist and the table, which are ordinary buttons and rows. A production
  version would add a "jump to station" combobox over the map.
- **`GET /stations/:id/readings/count` is implemented but unused.** The
  dashboard already holds each full series, so the tally is free from data in
  hand (ADR 0005). It stays in the client as the right tool the moment a caller
  needs stability *without* the series.
- **The 30-day chart shows daily means, not 720 hourly bars.** Sub-pixel bars
  imply a precision the eye cannot read. 7D uses 6-hour buckets. Both are
  labelled by range in the card subtitle.

  The bars are cut on the **Berlin clock**, not measured back from the snapshot
  instant. Trailing 24-hour windows were what I built first, and they are wrong
  in a way that only shows up if you read the axis: a bar labelled "12 Jun"
  covered 15:00 on the 12th to 14:00 on the 13th, when a daily mean means a
  calendar day — that is what the EU limit values are defined over. The cost is
  a partial bar at each end, which the tooltip states outright ("11 Jul
  00:00–15:00"), and two days a year that are 23 or 25 hours long, which
  `bucketBoundaries` handles by stepping through local midnights rather than
  adding 24 hours. Both DST days are unit-tested.
- **The tablet e2e project runs Chromium, not WebKit.** What it verifies —
  responsive layout, no hover-only interaction, tap targets — is
  engine-independent, and requiring a second browser engine would mean anyone
  running the suite downloads WebKit too. A real iPad-targeted product would
  add the WebKit project.

### An audit pass, and what it found

Late on, I went back through the brief line by line and ran the app rather
than trusting it. That found eight things worth fixing, and they are the
changes I would point at first:

- **A dead end in the watchlist.** Its empty state told the operator to star a
  station in the sensor list — and the sensor list had no star. Unstarring all
  four defaults left no way back. Now `WatchStar` is a shared control used in
  both places, with the watchlist cap surfaced as a disabled state that says
  why.
- **A feature reaching past the wrapper layer** (`SensorTable` importing
  PrimeVue's `Button` and `DataTable` directly), now `AppButton` / `DataGrid`
  plus the lint rule described above.
- **`aria-sort` on the sort button instead of the `<th>`**, where assistive
  tech actually reads it.
- **`role="application"` on the map**, which traps a screen reader's virtual
  cursor; `region` is the correct role for a landmark you can look at.
- **A blocking spinner over rows that were already readable** — station
  identity arrives before the readings, so the table now shows the rows and
  reports "Loading readings…" instead of hiding them.
- **Two empty states that were lying**: a dashboard search matching nothing
  rendered a blank map with no explanation, and the watchlist blamed "nothing
  tracked" when a search had simply hidden the rows.
- Numeric column headers misaligned with their cells, and the twelve contrast
  failures above.

A second pass, done by reading the shipped screens against the brief again
rather than the code, found four more:

- **A badge that contradicted itself.** One station in the dataset (BLN-0011)
  reports 0.8556 stability: below the brief's 86 % threshold, so a *poor* link —
  but rounded to nearest it printed "Poor link 86%", a figure the same brief
  calls healthy. Stability now rounds **down**, so the number clears 86 exactly
  when the state does (`formatStability`).
- **A sort that lied about its scope**, and **a search that fetched far more
  than it needed** — both described under "the table" above.
- **A count reported before it was known.** Entering a search rendered "0
  matching stations" for as long as the index took to arrive. It now says it is
  still searching, because zero is an answer and the table did not have one yet.

## 4 · What I'd do next, with more time

1. **Server-side aggregation.** This architecture is honest at 240 stations and
   is the wrong shape at the 10 000 the brief mentions: 10 000 series is not a
   client's job. The right answer is `/kpis?at=` and `/stations?bbox=` endpoints,
   with the client rendering rather than reducing. The domain functions would
   move to the server largely unchanged — they are already pure.
2. **Virtualised table** with infinite scroll over the cursor stream, once page
   size stops being 20.
3. **Deep links** for the selected station, range and pollutant, so an operator
   can send a colleague exactly what they are looking at.
4. **Visual regression tests** on both themes — the one class of bug the current
   suite still cannot see, now that behaviour and accessibility are covered.
5. **A real PM10 scale** from the regulator, replacing the doubling assumption.

---

## 5 · Tooling, and where I disagreed with it

I used Claude Code throughout, the way the job description describes: to move
quickly through work I already understood, with every decision and every line
reviewed. The architecture, the trade-offs above and the ADRs are mine; the
model was fastest at scaffolding, boilerplate and test bodies once the shape was
decided. `CLAUDE.md` in the repo root is the instruction file I wrote to keep it
inside the layering rules — the domain-purity constraint, "no fetch in
components", "cursor pagination only" — rather than re-litigating them per file.

The places I went against the obvious or suggested path:

- **PrimeVue 4, not 5.** `npm install primevue` gives you 5.0.1, which is where
  PrimeTek moved to a commercial licence — the package description says "premium
  UI library" and it peer-depends on `@primeui/license-manager`, an offline
  licence verifier. I pinned **4.5.5 (MIT)** with `@primeuix/themes` 1.2.5 so the
  submission has no licence question attached to it.
- **TypeScript 6, not 7.** 7.0.2 is `latest`, but `typescript-eslint@8` declares
  `typescript >=4.8.4 <6.1.0`; upgrading would have silently broken linting. I
  took the newest version the ecosystem actually supports. Relatedly, TS 6
  deprecates `baseUrl` — I removed it and let `paths` resolve relative to the
  config, rather than silencing the warning with `ignoreDeprecations`.
- **vue-router 4, not 5.** v5 folds in build-time route codegen (unplugin,
  `@babel/generator`, chokidar) and peer-depends on Vite and Pinia. For two
  static routes that is dependency surface with no payoff.
- **Hand-rolled SVG sparkline, not a chart instance per row.** The suggested
  path was reusing ECharts. A canvas context, resize observer and init cost per
  row, to draw a line with no axes and no interactivity, is the wrong tool
  (ADR 0008 — ~20 lines, and the normalisation is unit-tested).
- **Leaflet directly, not a Vue binding library.** At one tile layer and 240
  circle markers, the binding library's API surface is larger than the map code
  it replaces (ADR 0004).
- **Sorting is mine, not `DataTable`'s.** The built-in sort would order the
  twenty rows the component was handed; ordering has to apply to the whole
  result set in search mode, so it lives in `useSensorTable`.

The other correction worth recording is one the tests caught rather than me: on
Node 25 the `localStorage` global in the test environment is a bare object with
no methods, so the persistence tests failed while the app was fine (every
storage call is wrapped in `try`/`catch`). The fix is a conforming in-memory
Storage installed in `tests/setup.ts` only when what's already there doesn't
work — not a change to application code that was behaving correctly.
