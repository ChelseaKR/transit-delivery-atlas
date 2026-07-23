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

The page’s single job is to make those records inspectable.

## Visual direction

The design is a **public research register**: quiet, dense, source-led, and
designed for repeated inspection. It should feel closer to an annotated
catalogue than to a campaign landing page, operations dashboard, newspaper, or
government website.

The interface leads with the records themselves. Large promotional headlines,
decorative route diagrams, persistent filter sidebars, and stacked card surfaces
are avoided because they delay access to the evidence model. Structure comes
from document sequence, thin rules, compact locators, and the visible separation
of source, evidence, and analysis.

### Palette

- **Route paper** `#F5F7F6` — page background
- **Paper** `#FFFFFF` — primary record surface
- **Night platform** `#172126` — primary text
- **Timetable blue** `#255F85` — links and source records
- **Transfer teal** `#3F7068` — analytical-layer accent
- **Signal orange** `#965932` — evidence-layer accent
- **Rail steel** `#DFE4E2` — borders and secondary structure

Color never carries meaning alone.

### Typography

- **Atkinson Hyperlegible** — headings, body, and interface text
- **Barlow Condensed** — directive numbers, source locators, and compact
  wayfinding only

System fallbacks are acceptable if font delivery becomes a launch risk.

### Signature element

A compact **provenance triplet** appears on directive rows:

`S  E  A`

It records the three available layers—signed source, reviewed evidence, and
independent analysis. Evidence includes the number of linked records. The
triplet acts as both a legend and a quick coverage scan; it remains legible
without color.

### Layout sketch

```text
┌───────────────────────────────────────────────────────────────┐
│ N-7-26  Transit Delivery Atlas     Atlas Evidence Research   │
├───────────────────────────────────────────────────────────────┤
│ Independent analysis · Unofficial                            │
│ Transit Delivery Atlas             21 directives · 2 records │
│ Source: signed Executive Order N-7-26                         │
├───────────────────────────────────────────────────────────────┤
│ Search        Theme        Named lead        Timing           │
├──────┬──────────────────┬──────────┬────────────┬──────────────┤
│ 1(a) │ Priority list    │ CalSTA   │ Oct 2026   │ S  E 0  A    │
│ 1(b) │ Mobility Manager │ CalSTA   │ Oct 2026   │ S  E 0  A    │
│ 5    │ Funding programs │ CTC      │ None stated│ S  E 2  A    │
└──────┴──────────────────┴──────────┴────────────┴──────────────┘
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
