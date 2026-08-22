# ADR 0002 — Apache ECharts for the time-series chart

**Status:** accepted · 2026-08-22

## Context

Chart library is free choice. The main chart is a combo: PM10 as bars,
PM2.5 as an overlaid line, shared time axis, 24H/7D/30D ranges, themable in
light/dark.

## Decision

Apache ECharts via `vue-echarts`, importing only the needed modules from
`echarts/core` (bar, line, grid, tooltip, dataset) to keep the bundle sane.

## Rationale

- Bar + line on one time axis is a first-class ECharts case; Chart.js needs
  more manual coordination for mixed types with time scales.
- Canvas rendering makes 720 points (30 d hourly) a non-issue.
- Full runtime theming: palette, axis and tooltip colours read from the same
  CSS variables as the rest of the UI, so the theme toggle covers the chart
  with no second style source.

## Range display

24H renders raw hourly points (24 bars, matching the mockup). 7D and 30D are
bucketed in `domain/downsample.ts` (6 h / 24 h means, cut on the Berlin clock) — 720 raw bars are
unreadable and visually dishonest about density.

## Considered and rejected

- **Chart.js** — lighter, but mixed-type time charts and theming need more
  glue; the saved bytes don't buy anything here.
- **ApexCharts** — SVG rendering is the wrong default for dense bar series.
