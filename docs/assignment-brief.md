> Preserved verbatim from the assignment as delivered. The submission's own
> README is at the [repository root](../README.md); the detailed frontend brief
> is at [`frontend/README.md`](../frontend/README.md).

# Wised — Frontend Take-Home Assignment

Welcome, and thanks for taking the time to work through this.

We run a network of low-cost **air-quality sensor stations** across **Berlin** —
roughly 10,000 of them. Each station measures particulate matter (**PM2.5** and
**PM10**, in µg/m³) and continuously streams readings. Your assignment is to
build the operator-facing dashboard that turns that stream into something an
operator can read at a glance.

## The Assignment

### Air Quality Monitoring Dashboard

A web app built with **Vite** and either **Vue 3 + PrimeVue** or
**React + PrimeReact** — your choice, both are equally welcome — that visualises
Berlin's air quality across two pages behind a shared app shell, in a light and a
dark theme, from a wide desktop monitor down to an iPad:

- **Dashboard** — station lookup, a KPI row, an OpenStreetMap-based sensor map,
  a watchlist of tracked districts, and a full-width PM2.5 / PM10 time-series
  chart.
- **Sensor List** — the full station network as a sortable, searchable,
  cursor-paginated table.

The full brief is in [`frontend/README.md`](../frontend/README.md), alongside the
reference mockups: [`dashboard.png`](../frontend/dashboard.png) and
[`sensors-list.png`](../frontend/sensors-list.png), each with a `_dark` counterpart.
They show the desktop layout; the tablet layout is yours to work out.

## Repository Layout

```
.
└── frontend/                     # Frontend assignment
    ├── README.md                 #   → frontend brief
    ├── dashboard.png             #   → reference mockup · dashboard (light)
    ├── dashboard_dark.png        #   → reference mockup · dashboard (dark)
    ├── sensors-list.png          #   → reference mockup · sensor list (light)
    └── sensors-list_dark.png     #   → reference mockup · sensor list (dark)
```

## What We're Looking For

- **Component design** — shared UI elements built as dedicated, reusable
  components on top of PrimeVue / PrimeReact, so a design change propagates from
  one edit point. The two pages share badges, tiles and controls; theming comes
  from one set of tokens, not per-view overrides.
- **UI & data visualisation** - a clean, readable layout and charts/map that
  communicate the data clearly, holding up across 16:9 / 16:10 desktop screens
  and on an iPad.
- **Code quality** — clean, tested, and consistently structured.
- **Reasoning** — the thinking behind the above: why this structure, this
  boundary, this trade-off, and what you considered and rejected.

## On AI — Read This Part

Use whatever tooling you like, AI included. A working dashboard is cheap to
produce now and we have no interest in pretending otherwise, so the finished
screens are not what earns you the next conversation. **The reasoning behind
them is.**

What we're asking is that the submission be yours in the sense that matters:
don't act as a relay between us and a model. Code you haven't read, don't
understand and can't defend is the one failure mode that ends the process, no
matter how polished it looks on screen.

We will read the code with you and ask about specific lines. Expect to answer:

- why a piece of state lives where it does, and what you tried first;
- how you decided what became a shared component and what stayed local;
- where you traded completeness or correctness for time, and why that was the
  right call here;
- for anything a model wrote and you kept — on what grounds you kept it.

"That's what the AI gave me" is not an answer. "I chose it because X, and here's
what I ruled out" is a good one — including when X turns out to be arguable.
A smaller submission you can reason about end to end beats a complete one you
can't.

So please **do** send a `NOTES.md`: the trade-offs you made, the assumptions you
took where the brief was silent, what you'd do with more time, and where you
disagreed with your tools. It's the most useful thing in the whole submission —
treat it as part of the assignment rather than an optional extra.

## Questions

If anything is unclear or you're unsure how to interpret part of the brief,
**just ask** — reach out any time. We'd much rather answer a question than have
you guess. Where the spec leaves room, use your judgement and note the
assumptions you made.

Good luck — we're looking forward to seeing what you build.
