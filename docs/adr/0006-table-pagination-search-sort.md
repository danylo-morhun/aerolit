# ADR 0006 — Sensor List: cursor pagination vs search/sort semantics

**Status:** proposed · 2026-08-22 · (clarification requested from Wised,
awaiting reply)

## Context

`GET /stations` is cursor-paginated by design, sorted by id, with no
server-side search or sort. The brief simultaneously asks for a sortable
table filtered by the header search, and forbids walking every page up front
to build one big client-side list. These constraints conflict for any sort
key the server doesn't order by.

## The question I asked rather than guessed

The brief says to ask when something is unclear, and this is the one place
where two defensible readings lead to visibly different products. Sent to
Alessandro on **2026-08-22**, verbatim:

> Quick question about the Sensor List before I lock in the design.
>
> The /stations endpoint is cursor-paginated with no server-side search or
> sort, while the brief asks for a sortable table filtered by the header
> search. I see two reasonable readings:
>
> 1. Sorting/filtering apply to the currently loaded page only, keeping
>    pagination strictly cursor-driven;
> 2. Search/sort operate across the full network (the station identity list is
>    lightweight), with cursor pagination as the default browse mode.
>
> I'm currently leaning towards (2) with per-row lazy enrichment, since
> page-scoped sorting makes for a confusing operator experience — but I'd
> rather check the intent than guess against the "don't build one big
> client-side list" constraint.

No reply yet at the time of writing. The build proceeds on (2), structured so
that (1) is a deletion rather than a rewrite — see *Reversibility* below.

## Options

- **A. Page-scoped search/sort.** Pagination stays purely cursor-driven;
  sorting and filtering apply to the 20 loaded rows only. Honest to the API,
  but an operator sorting by PM2.5 sees a per-page maximum — confusing and
  arguably worse than no sort.
- **B. Browse vs. query modes.** Default mode: cursor pagination, server
  order, next/previous. Entering a search term or a non-id sort switches to a
  query mode over the lightweight station identity list (id, district,
  location — already needed for the map), windowed client-side, with readings
  fetched lazily for visible rows only. Leaving the query returns to cursors.
- **C. Pre-walk everything.** Explicitly prohibited.

## Decision (pending confirmation)

Lean **B**: it reads the prohibition as targeting bulk data hoarding (all
readings, all pages eagerly), not the ~240-entry identity index the dashboard
map already requires; and it delivers the operator-grade behaviour the mockup
implies.

Two details of B are worth stating explicitly, because both were wrong in a
first pass and fixing them is what makes the mode boundary principled:

- **The server's order is `id` ascending — key *and* direction.** Descending by
  id is not a free reversal of the page: page one reversed is stations 1–20
  backwards, never 240–221. So it is as much a whole-collection question as
  sorting by PM2.5, and it switches mode too (`isServerOrder` in
  `src/domain/sort.ts`). The alternative — reversing twenty rows while the
  footer says "browsing the network" — is a page-scoped answer wearing a
  network-wide label.
- **"Lazy enrichment" means what it says.** Search mode fetches the identity
  index (240 rows, 3 requests, ~40 kB) and then readings *only for the twenty
  rows on screen*. The one exception is ordering **by a measured column**
  (PM2.5, PM10, AQI, Connection): you cannot know which twenty stations have
  the highest PM2.5 without looking at all 240, so that question — and only
  that question — pulls every series. Measured in the running app: a text
  search costs 3 requests, a sort by district 23, a sort by PM2.5 243.

## Consequence

- Pagination controls must communicate mode: cursor next/previous with
  disabled states when a cursor is absent (browse), result count + windowing
  (query).
- In search mode the snapshot instant is derived from the rows on screen, as
  it is in browse — the same trade-off, recorded in `NOTES.md`.

## Virtualisation, and why the window is not about the DOM

Revisited with measurements rather than instinct, because "virtualise the
table" is the reflex answer to a paginated list and it is the wrong one here.

Rendering the entire 240-station match set costs **10.6 ms** at desktop width
and **10.9 ms** at 768 px — 1920 cells, inside a single 16 ms frame. There is
no rendering problem to solve.

The window is not there to bound DOM nodes. It is there to bound *requests*:
each visible row fetches its own 30-day series, so twenty rows is twenty calls.
A virtualised list of all 240 matches would have to fetch readings for whatever
the scroll position exposes — which is the same twenty-at-a-time enrichment,
triggered by scrolling instead of by a click. Virtualisation would buy a
different interaction, not a different cost.

Against that it asks for a fixed `itemSize`: PrimeVue's virtual scroller
positions rows arithmetically, so every row must be the same height. The
neighbourhood column wraps for the longer names at narrower widths, and making
it uniform means truncating one of the columns the table exists to show.

So it stays paginated, and the condition that would change the answer is
recorded instead of guessed: virtualisation becomes right when a page stops
being twenty rows — the network-wide roll-up the brief's 10 000 stations would
need, served by an aggregate endpoint, with rows that no longer each carry a
request of their own.

## Reversibility

If Wised confirms reading (1), the change is a deletion: drop the `search`
branch of `useSensorTable.ts` and make `isServerOrder` return `true` for any
key. The table, its columns, the domain comparators and every test around
browse mode are untouched.
