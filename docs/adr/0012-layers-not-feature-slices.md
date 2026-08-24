# ADR 0012 — Layers by responsibility, not feature slices

**Status:** accepted · 2026-08-24

## Context

Vue ships no canonical project layout. The scaffold emits `components/` and
`views/`; the convention most often argued for in 2026 is **Feature-Sliced
Design** (`app / pages / widgets / features / entities / shared`, each slice cut
into `ui`, `model`, `api`, `lib`). Something had to be picked before the first
component, and "it is what the CLI generated" is not a defence.

The shape of this app decides the answer more than the fashion does: two pages,
**one** business entity (a station), 74 source files, one developer.

## Decision

Layers by responsibility, with the dependency direction enforced:

```
pages → features → (components/ui, queries, stores) → (api, domain)
```

`src/domain/` is pure — no Vue, no `fetch`, no ambient clock — and depends on
nothing. `src/components/ui/` is the only layer allowed to import `primevue/*`.
Both rules are `eslint.config.ts` restrictions, not comments in a README.

## Rationale

- **What FSD is admired for is the import rule, and the import rule is here** —
  as a check that fails the build, which is the only version of an architecture
  that survives a deadline. The folder names are the packaging; the direction is
  the substance.
- **The load-bearing boundary is purity, and no layout convention provides it.**
  FSD would let `entities/station/model` import a store, a clock or a fetch and
  still be idiomatic FSD. The claim this codebase actually makes — that the 13
  modules of `domain/` move to a server unchanged when the network is 10 000
  stations ([ADR 0011](0011-scaling-to-ten-thousand-stations.md)) — is only true
  because that folder is *pure*, which is a property of its contents rather than
  of its position in a tree.
- **The cost of a slice layout is fixed; its benefit scales with coupling that
  does not exist here.** FSD's unit of isolation is the slice, and it earns its
  ceremony when many features touch the same entities and cross-imports need
  policing. With one entity and two pages it would produce seven top-level
  directories holding one or two files each, and police imports that are already
  policed.
- **It answers "why does this live here" in one sentence per layer**, which is
  the question an unfamiliar reader actually asks: fetched → `queries/`, chosen
  by the operator → `stores/`, derived → `domain/`, shared and Prime-wrapping →
  `components/ui/`, page-specific composition → `features/`.

**The seam, stated rather than hidden.** `queries/useSensorTable.ts` is in
substance the Sensor List's model — it owns the browse/search mode, the sort key
and the cursor — and a slice layout would put it beside `SensorTable.vue`. It
sits in `queries/` because it also owns a slice of the shared readings cache
that the dashboard reads from; co-locating it would place a second owner of that
cache inside a feature folder. That is a real trade, and the opposite choice
would have been defensible.

## Considered and rejected

- **Feature-Sliced Design.** Rejected for the size, not the idea: the import
  discipline it brings is already enforced, and its layout would add six
  boundaries between files that have no reason to be apart. It is the right move
  the moment a third page and a second entity arrive, or when features begin
  importing each other — that is the trigger, and it is worth restructuring for
  when it fires rather than in anticipation.
- **The scaffold default (`components/` + `views/`).** No boundary at all: a
  view may fetch, a component may derive a KPI, and nothing says otherwise until
  the same metric is computed two ways in two places. That drift is precisely
  what the domain rule exists to prevent.
- **Atomic design (`atoms/molecules/organisms`).** Classifies UI by size when
  the question this codebase needs answered is ownership — *may this file import
  PrimeVue?* `components/ui/` answers it with one line of lint config; atomic
  design spreads the answer across three folders and invites an argument about
  whether `StatTile` is a molecule.
- **A folder per page, sharing nothing.** Cheapest possible layout for two
  pages, and it works right up to the first shared badge: `AqiBadge`,
  `TrendBadge` and every domain function are used by both pages, so they would
  end up living wherever they were needed first, which is how a `dashboard/`
  folder becomes the place the sensor list imports from.
