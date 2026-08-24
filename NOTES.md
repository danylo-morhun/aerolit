# NOTES

The reasoning behind the submission: what I decided, what I assumed where the
brief was silent, what I left out, and where I disagreed with my tools.

Decisions that needed room to breathe are written up as ADRs in
[`docs/adr/`](docs/adr/) — each records what I rejected as well as what I chose.
This file is the summary and the honest list of edges.

**If you read one page of it, read this list.** These are the six I would most
like to be asked about:

1. [The domain layer is pure, and that is enforced](#the-domain-layer-is-pure-and-that-is-enforced)
   — no Vue, no `fetch`, no clock, checked by ESLint rather than agreed in a
   README. It is what makes the scaling answer in ADR 0011 more than a claim.
2. [Verifying the definitions, not just the functions](#verifying-the-definitions-not-just-the-functions)
   — the four KPIs recomputed independently in Python and pinned against the
   shipped data, because a green unit test only proves a function matches its
   own name.
3. [Real week-over-week badges, and the clamp that makes them true](#real-week-over-week-badges-and-the-clamp-that-makes-them-true)
   — the brief allows a placeholder; building the real thing surfaced a
   +22-point network recovery that never happened.
4. [The table: cursor pagination versus search and sort](#the-table-cursor-pagination-versus-search-and-sort)
   — where the brief's constraints genuinely conflict, what I asked Wised, and
   how the answer I did not get is one deletion away.
5. [Accessibility caught a real defect in the design](#accessibility-caught-a-real-defect-in-the-design)
   — twelve contrast failures, one of them in the mockup itself.
6. [Four audit passes, and what they found](#four-audit-passes-and-what-they-found)
   — twenty defects the test suite was too green to notice, including the one
   that made the dashboard unusable to actually use.

---

## 1 · The decisions I'd most want to defend

### The domain layer is pure, and that is enforced

Every derived number in the app — AQI category, stability %, connection state,
the four KPIs, the week-over-week deltas, the chart buckets — is computed by a
pure function in `src/domain/`. No Vue, no `fetch`, no `Date.now()`. It isn't a
convention: `eslint.config.ts` restricts imports and the ambient clock inside
that folder. That rule, rather than the folder names, is why the layout is
layers by responsibility instead of feature slices — the comparison with FSD and
the three other layouts I considered is
[ADR 0012](docs/adr/0012-layers-not-feature-slices.md).

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
| **Fonts are bundled, not loaded from Google's CDN** | The mockup is clearly not set in a system font, but embedding Google Fonts sends the visitor's IP to the US without consent — held to breach the GDPR by a German court in 2022, which is not a footnote for a Berlin network run from the EU. Only the latin subset and the seven weights this UI uses are shipped: 103 kB of woff2, which is what any target browser fetches (the woff fallbacks sit unused in `dist/` for older ones). A system-font stack still backs them. |
| **The map card says "Particulate readings", where the mockup says "Real-time particulate readings"** | The dataset is a fixed snapshot the brief says not to poll. Calling it real-time would be the one piece of copy on the page that isn't true. |
| **Tablet layout** | No mockup was given. KPIs go 4→2 columns at 900 px; the map/watchlist split stacks at 1100 px, where the watchlist becomes two columns to use the width. Measuring at 768, 820, 1024 and 1180 px in both orientations is how the one real defect turned up: in portrait the sensor table came to 796 px against 734 px of card, putting the connection column behind a sideways scroll at the exact size the brief names. The cell gutters were paying for that width and give it back below 900 px (`--aq-table-cell-padding`); all eight columns now fit. |
| **There is a phone layout, though the brief does not ask for one** | At 320–430 px the shell clipped "Sensor List" mid-word and the table hid PM2.5, PM10, AQI and connection behind a sideways scroll — and not the three columns anyone opens it for. The layout had to change rather than narrow, so it changed properly: the app bar wraps, the KPI row goes to one column below 360 px, the map legend moves under the canvas, and each row becomes a card ([below](#3--where-i-traded-completeness-for-time)). Covered by its own Playwright project at 390 px, axe included. |

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
  than none; keyboard and screen-reader users reach any station through the
  watchlist, the table, and the header search, which narrows the map to one
  marker and selects it — chart and URL included, pinned in `e2e/shell.spec.ts`.
  I had written here that a production version would add a "jump to station"
  combobox, then checked: it would duplicate the search field a tab stop away.
  What is genuinely missing is picking a marker *spatially* — "the one in the
  north-east" — which a combobox would not give either.
- **`GET /stations/:id/readings/count` is implemented but unused.** The
  dashboard already holds each full series, so the tally is free from data in
  hand (ADR 0005). It stays in the client as the right tool the moment a caller
  needs stability *without* the series.
- **The 30-day chart shows daily means, not 720 hourly bars.** Sub-pixel bars
  imply a precision the eye cannot read; 7D uses 6-hour buckets, and both are
  labelled by range in the card subtitle.

  Two separate decisions sit underneath that, and only the axis unit tells them
  apart. The **bars** are cut on the Berlin clock, because a daily mean means a
  calendar day — trailing 24-hour buckets, which is what I built first, put "12
  Jun" over 15:00 on the 12th to 14:00 on the 13th. The **window** trails the
  snapshot hour instead, so 24H runs 15:00 → 14:00 rather than 00:00 → 23:00;
  snapping it to midnight would make "24H" mean 15 bars in the afternoon and 24
  at night. The costs — a partial bucket at each end, and 24H crossing midnight
  in the middle — are stated in the tooltip and worked through in
  [ADR 0010](docs/adr/0010-chart-windows-and-buckets.md). The two DST days that
  are 23 and 25 hours long are unit-tested.
- **The phone table is a card list rather than a narrower table.** Eight columns
  do not fit 390 px under any amount of squeezing, and dropping columns would
  have hidden the readings the table exists for, so below 640 px each row
  becomes a card of labelled fields. Two details keep that a design decision
  rather than a CSS trick: the column headers are collapsed with clipping and
  never `display: none`, so they keep their `aria-sort` and sort buttons in the
  accessibility tree while the footer control serves everyone looking at the
  screen — one ordering model, two ways in; and the ARIA roles are spelled out,
  because laying a `tr` out as a block is what makes a browser drop the implicit
  table semantics.
- **The visual baselines are captured once, at desktop width on Chromium.**
  The iPad and phone layouts are asserted by measurement instead — widths, tap
  targets, which fields reach the screen — because repeating the screenshots per
  project would triple the images for the same information, and a baseline is
  only as useful as the diff someone actually reads. The engines themselves are
  covered: both the 768 px and the 390 px projects run on WebKit as well as
  Chromium, since a real iPad is a Safari and `clip-path`, `color-mix` and flex
  rounding are exactly where engines disagree.

### Four audit passes, and what they found

Twenty defects, and the test suite reported green through all of them. Each pass
looked at something different: the brief line by line, then the shipped screens
against the mockups, then the running app and its build output, and finally
someone simply *using* the dashboard. The order matters — the last pass found
what none of the first three could.

**Reading the brief against the code.**

- **A dead end in the watchlist.** Its empty state told the operator to star a
  station in the sensor list, and the sensor list had no star; unstarring the
  four defaults left no way back. `WatchStar` is now one shared control used in
  both places, with the cap surfaced as a disabled state that says why.
- **A feature reaching past the wrapper layer** — `SensorTable` importing
  PrimeVue's `Button` and `DataTable` directly. Now `AppButton` / `DataGrid`,
  with the lint rule that stops it recurring.
- **`aria-sort` sat on the sort button, not the `<th>`** where assistive tech
  reads it; **`role="application"` on the map** trapped a screen reader's
  virtual cursor, where `region` is the role for a landmark you look at.
- **A blocking spinner over rows that were already readable.** Station identity
  arrives before the readings, so the table now shows the rows and reports
  "Loading readings…" rather than hiding them.
- **Two empty states that were lying** — a dashboard search matching nothing
  rendered a blank map with no explanation, and the watchlist blamed "nothing
  tracked" when a search had merely hidden the rows — plus numeric headers
  misaligned with their cells and the twelve contrast failures above.

**Reading the shipped screens against the mockups.**

- **A badge that contradicted itself.** BLN-0011 reports 0.8556 stability:
  below the brief's 86 % threshold, so a *poor* link — but rounded to nearest it
  printed "Poor link 86%", a figure the same brief calls healthy. Stability now
  rounds **down**, so the number clears 86 exactly when the state does.
- **A count reported before it was known.** A search rendered "0 matching
  stations" while the index was still arriving; zero is an answer, and the table
  did not have one yet. It now says it is still searching.
- **A sort that lied about its scope, and a search that fetched far more than it
  needed** — both described under [the table](#the-table-cursor-pagination-versus-search-and-sort).

**Auditing the running app and the build output.**

- **Every tap on the map rebuilt all 240 markers.** The redraw watcher covered
  the selection alongside the station set, so selecting one station tore down
  240 `circleMarker`s and their tooltips to change two of them. The layer is now
  rebuilt only when the set of stations changes; a selection repaints the marker
  leaving it and the one taking it. This is the interaction an operator repeats
  all day, and it was the most expensive thing on the page.
- **The axis labelling lived in the component**, where it could not be tested
  without mounting ECharts — the one derived value outside `src/domain/`,
  against this repo's own rule. Moving it to `domain/chart-axis.ts` with a spec
  is what surfaced the missing day boundary on the 24H axis.
- **`prefers-reduced-motion` was only half honoured.** The stylesheet zeroes CSS
  transitions, but ECharts animates on a canvas and Leaflet animates its own
  panes; neither reads a stylesheet. Both now ask, reactively, so changing the
  OS setting reaches an open page.
- **The icon font shipped in five formats.** PrimeIcons declares `eot`, `woff2`,
  `woff`, `ttf` and a 342 kB SVG font, and Vite copied all five although every
  target browser takes the woff2. A six-line build plugin rewrites the `src`
  descriptor: **597 kB** of assets nothing would request, gone.
- **`npm test` printed two unhandled rejections while reporting all green** —
  jsdom has no `scrollIntoView`. The suite was green and the output was not, and
  only one of those is what a reviewer sees first.

**Using the dashboard.**

- **Touching any control threw the page back to the top.** Putting the selection
  in the URL turned picking a marker into a `router.replace`, and the router's
  blanket `scrollBehavior: { top: 0 }` treated each one as arriving somewhere
  new. On a page whose whole point is that the map, the watchlist and the chart
  are visible together, that made the dashboard unusable. Scrolling now happens
  only when the path actually changes.
- **The watchlist was scrolling the document.** `scrollIntoView({ block:
  'nearest' })` moves *every* scrollable ancestor, so keeping the selected row
  visible slid the whole page a hundred pixels. Both defects are pinned by a
  test that reports which of the two moved the page, because from the outside
  they looked identical.
- **The suite was outrunning its own fixture.** Six Playwright projects at seven
  workers against a single-threaded mock server failed about one run in four,
  always somewhere different. Capping the workers costs ten seconds and bought
  ten clean runs. Plainly: for a while I was fixing the tests that complained
  rather than the reason they complained.
- **And CI found the last place that judgement was wrong.** On GitHub's runner
  the walk to the final cursor page — 11 sequential round-trips, each with the
  pager deliberately disabled while its page is in flight — cost ~3 s a step
  against ~0.5 s locally, so the 30 s test budget expired mid-walk with every
  assertion still passing. The fix was the clock (90 s a test and 20 s an
  assertion on CI, 30 s and 5 s locally): walking fewer pages, or leaving the
  pager live during a fetch, would each have deleted something the test exists
  to prove. Five seconds locally is a claim about the app; five seconds on a
  two-core runner is a claim about the runner.

## 4 · What I'd do next, with more time

1. **Server-side aggregation**, written up with numbers in
   [ADR 0011](docs/adr/0011-scaling-to-ten-thousand-stations.md). This
   architecture is honest at 240 stations and is the wrong shape at the 10 000
   the brief names: the series are 9.2 MB here and **382 MB** there, which no
   pool size or rendering technique touches. The answer is `/kpis?at=`,
   `/stations?bbox=` and server-side ordering, with the client rendering rather
   than reducing. The part I would want to be judged on is how short the
   migration is: **four files change** — the ones whose job is fetching — while
   the 13 modules and 1 004 lines of `src/domain/` move to the server unchanged, because they
   are pure by contract with the instant passed in as `at`. That is what the
   boundary was for. The ADR also puts virtualisation where it belongs: a
   consequence of that migration, not a precursor to it.
2. ~~**Virtualised table** with infinite scroll over the cursor stream.~~
   Measured and decided against, written up in
   [ADR 0006](docs/adr/0006-table-pagination-search-sort.md): all 240 matched
   rows render in 10.6 ms, so there is no DOM cost to remove, and the twenty-row
   window exists to bound *requests* — each visible row fetches its own series —
   which scrolling would not change, only re-trigger. It also wants a fixed row
   height, and the neighbourhood column wraps. The condition that flips it is
   recorded: a page that stops being twenty rows, fed by an aggregate endpoint.
3. ~~**Deep links** for the selected station, range and pollutant.~~ Built:
   `?station=&range=&pollutant=`, defaults left out of the URL so a link carries
   choices rather than noise (`useSelectionUrl.ts`). The one thing that made it
   more than an afternoon: the dashboard settles its selection *after* 240
   series arrive, so a `replace` could land mid-navigation and cancel the
   operator's tap through to the sensor list. The leave guard closes that
   window; the round trip is pinned in e2e.
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
- **Fonts in the bundle, not a Google Fonts `<link>`.** The two-line CDN snippet
  is what every scaffold emits and what I had in `index.html` for most of this
  build. Embedding it sends every visitor's IP to Google without consent, which
  a Munich court held to breach the GDPR in 2022 — a live concern for an EU
  operator's dashboard, and not something I would want a reviewer to be the one
  to notice. The usual counter-argument, that a CDN font is already cached from
  another site, stopped being true when browsers partitioned the HTTP cache per
  origin. So `@fontsource`, latin subset, the seven weights this UI actually
  sets: 103 kB of woff2 fetched, no third-party request, and the app renders
  identically with the network unplugged.
- **Sorting is mine, not `DataTable`'s.** The built-in sort would order the
  twenty rows the component was handed; ordering has to apply to the whole
  result set in search mode, so it lives in `useSensorTable`.

The other correction worth recording is one the tests caught rather than me: on
Node 25 the `localStorage` global in the test environment is a bare object with
no methods, so the persistence tests failed while the app was fine (every
storage call is wrapped in `try`/`catch`). The fix is a conforming in-memory
Storage installed in `tests/setup.ts` only when what's already there doesn't
work — not a change to application code that was behaving correctly.
