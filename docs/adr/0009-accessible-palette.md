# ADR 0009 — Darkened text palette, vivid graphics

**Status:** accepted · 2026-08-22

## Context

The palette sampled from the reference mockups fails WCAG AA contrast for
small text. An automated axe pass over both pages found twelve distinct
violations, the worst being the Moderate amber `#e0a93a` at 2.1:1 on white
where 4.5:1 is required, and the muted `#a7a29c` at 2.3:1. The connection
red `#d6463a` missed by a hair, at 4.37:1.

This is a real conflict: the mockups are the visual spec, and matching them
exactly ships a dashboard whose status text is hard to read — in a control
room, on a laptop in daylight, or for anyone with reduced contrast
sensitivity.

## Decision

Split the palette by *role*, following the two thresholds WCAG actually
defines:

- **Graphics** (map markers, legend dots, sparklines, chart series) keep the
  mockup hues exactly. WCAG 1.4.11 asks 3:1 of non-text content, which they
  meet, and the category colour is the thing that makes the map scannable.
- **Text** (chip labels, connection status, table figures, muted captions)
  uses a darkened variant of the same hue — the minimum darkening that clears
  4.5:1 against every background it appears on, with hue and saturation
  preserved so the family still reads as one palette.

Concretely, `--aq-c-good: #5ca56c` for markers alongside
`--aq-c-good-text: #41764d` for type, and the same pairing for the other
three categories plus the accent and the muted neutral.

The AQI chips keep their light tinted backgrounds in *both* themes, as the
mockups show, so `--aq-chip-*-fg/bg` are defined once and deliberately never
re-pointed in the dark block — that pairing is theme-independent and its
contrast is therefore valid in both.

## Consequence

Enforced rather than asserted: `e2e/shell.spec.ts` runs `@axe-core/playwright`
over both pages in both themes, so a future colour change that breaks contrast
fails the suite.

The visible cost is that status text is a shade deeper than the comp. That is
the deviation I would raise with the designer rather than ship silently, and
it is recorded in NOTES.md.

## Considered and rejected

- **Match the mockups exactly** — ships a known accessibility defect and would
  be the first thing an audit flags.
- **Darken the hues everywhere, graphics included** — muddies the map, which
  is the one place the vivid palette is doing real work, and over-applies a
  rule that does not govern graphics.
- **Enlarge the type instead** (large text needs only 3:1) — the badge and
  table scale come from the mockups too, and inflating them would distort the
  layout far more visibly than a shade of colour.
