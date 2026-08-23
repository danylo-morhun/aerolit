# ADR 0010 — Chart windows trail the snapshot; buckets follow the calendar

**Status:** accepted · 2026-08-22

## Context

The chart offers 24H / 7D / 30D over a fixed snapshot whose latest hour is
`2026-07-11T12:00Z` — 14:00 in Berlin. Two questions have to be answered
separately, and conflating them is what produces an axis nobody can read:

1. **Where does the window start and end?**
2. **How is the window cut into bars?**

The visible symptom that prompted writing this down: the 24H axis runs 15:00
to 14:00, not 00:00 to 23:00, and a reviewer is entitled to ask whether that
was decided or merely happened.

## Decision

**The window always trails the snapshot instant.** `24H` is the 24 hours
ending at the latest reported hour, `7D` the 168 hours, `30D` the 720. The
label states a duration, and the window is exactly that duration.

**The bars inside it are cut on the Berlin clock** for the two bucketed
ranges: 30D bars open at local midnight, 7D bars at 00/06/12/18 local. 24H
plots the raw hourly readings, which are already on the hour.

**Every range dates the bar that opens a local day** (`domain/chart-axis.ts`),
so the day boundary is visible wherever it falls inside the window.

## Rationale

- **A trailing window is the question an operator is asking.** "Last 24 hours"
  is what a monitoring dashboard means by 24H. Snapping the window to midnight
  instead would produce 15 bars at 15:00 and 24 bars at 23:00 — a range whose
  length depends on the time of day, under a label that claims a fixed one.
  That is "today so far", a different and less useful question, and the tile
  would have to be renamed to stay honest.
- **A calendar cut is what "daily mean" means.** The bucketed ranges label
  their bars with a *date*, and a bar labelled "12 Jun" that ran 15:00 on the
  12th to 14:00 on the 13th is mostly the 13th. Daily means in air quality —
  including the EU limit values these figures would be compared against — are
  calendar days. So the cut follows the label.
- **The two rules agree, they do not conflict.** The unit on the axis decides
  the cut: hour labels need no calendar, date labels do. 24H is not an
  exception to the calendar rule; it is a range that never invokes it.

## Consequences

- A partial bar at each end of 7D and 30D. This is honest — the day at the
  right-hand edge really is still in progress — and the tooltip names the span
  outright ("11 Jul 00:00–15:00") rather than implying a whole day.
- The 24H axis crosses midnight in the middle. With hours alone on it, "03:00"
  gives no clue which day it belongs to, so the bar that opens the day carries
  its date instead of its hour, and the neighbouring hour label is suppressed
  so the two do not overprint. Unit-tested in `chart-axis.spec.ts`.
- Two days a year are 23 or 25 hours long. `bucketBoundaries` steps through
  local midnights rather than adding 24 hours; both DST days are tested.

## Considered and rejected

- **Snap the window to bucket boundaries too** — i.e. 7D = the last seven
  *calendar* days. Every bar would be whole, which is tidier. Rejected because
  the window would then be up to 191 hours long while the control says "7D",
  and because it hides the most operationally interesting bar: what is
  happening right now, in the day that has not finished.
- **Trailing 24-hour buckets for 7D/30D** — what was built first. Consistent
  with the window, and wrong at the axis: see the "12 Jun" case above.
- **Calendar-align 24H as well** — "today so far". A real view worth having,
  but it is a different control, not this one; adding it would mean four
  ranges, not redefining the existing three.
- **Label 24H with a date on every bar** — 24 dates, 23 of them identical.
