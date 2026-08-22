# ADR 0006 — Sensor List: cursor pagination vs search/sort semantics

**Status:** proposed · 2026-08-22 · (clarification requested from Wised)

## Context

`GET /stations` is cursor-paginated by design, sorted by id, with no
server-side search or sort. The brief simultaneously asks for a sortable
table filtered by the header search, and forbids walking every page up front
to build one big client-side list. These constraints conflict for any sort
key the server doesn't order by.

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
implies. A clarifying question has been sent; if the intent is a stricter
reading, we ship **A** and note the UX consequence.

## Consequence

Pagination controls must communicate mode: cursor next/previous with
disabled states when a cursor is absent (browse), result count + windowing
(query).
