# Brand system: Transit Delivery Atlas

## Naming decision

**Transit Delivery Atlas** is the masterbrand. It is clearer and more extensible
than an order-number-specific name, while keeping “California” out of the
masterbrand to reduce the risk of appearing official.

**Descriptor:** An independent, source-linked crosswalk for California Executive
Order N-7-26.

**Tagline:** From directive to delivery—making the handoffs visible.

**Repository and package slug:** `transit-delivery-atlas`

**Live site:** [transit.chelseakr.com](https://transit.chelseakr.com)

**Source repository:** [github.com/ChelseaKR/transit-delivery-atlas](https://github.com/ChelseaKR/transit-delivery-atlas)

### Shortlist considered

1. Transit Delivery Atlas — selected; clear, speakable, and extensible
2. Directive to Delivery — retained as a verbal signature
3. Mobility Delivery Atlas — broader than the product’s present scope
4. Transit Implementation Atlas — accurate but bureaucratic
5. Transit Delivery Ledger — strong evidence cue, weaker navigation metaphor
6. Transit Delivery Map — clear but generic and easily mistaken for geography

## Design subject and single job

The subject is the delivery system inside a statewide transit directive: named
entities, timing clauses, outputs, and handoffs. The primary audience is a
policy or program reader who needs to answer “who is named, what is directed,
and when?” without losing the source/analysis boundary.

The page’s single job is to make those handoffs inspectable.

## Visual direction

The design begins as an **operations board crossed with engineering markup**.
It does not imitate government web chrome, transit-agency branding, a newspaper,
or a generic civic-tech dashboard.

An earlier field-guide direction using warm cream, a literary serif, and a
red-brown accent was rejected because that combination has become a generic
editorial-site default. The revised system is cooler, more operational, and
grounded in the materials of transit delivery: timetable ink, transfer markers,
signal paint, and annotated work plans.

### Palette

- **Route paper** `#F5F9F8` — page background
- **Night platform** `#102A30` — primary text and dark surfaces
- **Timetable blue** `#145DA0` — links and source records
- **Transfer teal** `#00766C` — focus and analytical-layer accent
- **Signal orange** `#C9471B` — deadline markers and sparing emphasis
- **Rail steel** `#D9E5E2` — borders and secondary panels

Color never carries meaning alone.

### Typography

- **Barlow Condensed** — display headings, used with restraint like station
  wayfinding rather than advertising
- **Atkinson Hyperlegible** — body and interface text
- **IBM Plex Mono** — section IDs, dates, locators, and data labels

System fallbacks are acceptable if font delivery becomes a launch risk.

### Signature element

A functional **handoff rail** connects four shapes:

`source → named entity → timing → expected output`

The shapes act as a legend and information architecture, not decoration. They
are built with HTML and CSS, remain legible without color, and collapse into a
vertical sequence on narrow screens.

### Layout sketch

```text
┌───────────────────────────────────────────────────────────────┐
│ Independent analysis · Unofficial            Method  Data    │
├───────────────────────────────────────────────────────────────┤
│ TRANSIT DELIVERY ATLAS                                       │
│ California’s transit directives, mapped for delivery.        │
│                                                               │
│ [source]────[named entity]────◇ timing────● expected output   │
├───────────────────┬───────────────────────────────────────────┤
│ Filters           │ 1(a)  Priority project list              │
│ Theme             │ What the order says                       │
│ Named lead        │ Analytical crosswalk                      │
│ Timing            │ Open questions                            │
│ Search            ├───────────────────────────────────────────┤
│                   │ 1(b)  Mobility Manager                    │
└───────────────────┴───────────────────────────────────────────┘
```

## Voice

Source-first, calm, operational, and openly provisional.

Prefer:

- “The order directs…”
- “The signed order explicitly names…”
- “This date is calculated for planning convenience.”
- “This is an analytical inference.”
- “No explicit deadline is stated in the order.”

Avoid:

- “On track,” “behind,” “failed,” or “completed”
- “Accountability tracker”
- “Real-time” unless the update mechanism is genuinely real-time
- Absence of public evidence as proof of nonperformance

## Independence guardrails

- Display `Independent analysis · Unofficial` above the fold, in metadata, and
  in the footer.
- Cite public government and standards sources only.
- Do not use agency logos, seals, official headers, state animals, or official
  visual motifs.
- Do not mention private motivations, conversations, outside organizations, or
  individuals in copy, source, metadata, acknowledgments, or history.
- Label facts, excerpts, calculated dates, and analytical inferences distinctly.

## Repository description

> Independent, source-linked crosswalk of California transit directives, named
> entities, timing clauses, dependencies, evidence, and open questions.

Suggested topics: `public-transit`, `california`, `executive-order`, `civic-tech`,
`open-data`, `policy-implementation`, `accessibility`.

## Domain strategy

1. Current canonical domain: `transit.chelseakr.com`
2. Future standalone option: `transitdeliveryatlas.org`
3. Optional defensive redirect if the standalone domain is adopted: `transitdeliveryatlas.com`

As of July 12, 2026, authoritative RDAP returned no registration record for the
exact-match `.org` and `.com`. This is a preliminary availability signal, not
registrar confirmation or trademark clearance. Avoid `california`, `ca`, an
agency name, or the executive-order number in the domain.
