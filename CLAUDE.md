# CLAUDE.md — AI assistant guide for this repository

Air-quality monitoring dashboard (Wised frontend assignment): Vue 3 +
TypeScript + PrimeVue v4, two pages (Dashboard, Sensor List) over a local
mock API. Read `docs/ARCHITECTURE.md` first; decisions and their rejected
alternatives are in `docs/adr/`.

## Commands

```bash
node frontend/mock-data/server.mjs   # mock API on :8787 (run from repo root)
npm run dev                          # Vite dev server (in frontend/)
npm run test                         # Vitest
npm run lint && npm run typecheck    # ESLint 9 flat config · vue-tsc
```

## Hard rules

- **Layering:** `pages → features → (ui, queries, stores) → (api, domain)`.
  `src/domain/` is pure functions — no Vue, no fetch, no Date.now(). All
  metric definitions (AQI, stability, connection, KPI, trends) live there and
  only there; views never re-derive them inline.
- **"Now" is snapshot time** — the most recent reading hour in the data,
  never wall-clock. Pass it explicitly; don't call `Date.now()` in domain code.
- **Server data** goes through TanStack Query composables in `src/queries/`;
  never `fetch` in components, never cache server data in Pinia.
- **Shared UI** (`src/components/ui/`) wraps PrimeVue primitives; feature code
  uses the wrappers, not raw Prime components, so restyling stays a
  single-edit-point operation.
- **Theming:** all colours from the preset tokens / CSS variables — no
  hardcoded hex in components, charts or map styling. Both themes must work
  for any change.
- **Sensor List:** cursor pagination only (`after`/`before` from `pageInfo`);
  never pre-fetch all pages to build a client-side table.
- **No hover-only interactions** (iPad requirement).
- Every change to `src/domain/` lands with unit tests in the same commit.
- Conventional Commits, lowercase, atomic.

## Assignment source

The brief is `README.md` (root) + `frontend/README.md`; mockups are the four
PNGs in `frontend/`. `frontend/mock-data/` is given by the assignment — do
not modify it.
