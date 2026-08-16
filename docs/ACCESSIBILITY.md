# Accessibility approach

Transit Delivery Atlas is designed for readers who may use screen readers,
keyboard navigation, zoom, voice input, high-contrast settings, or other
assistive technologies. Accessibility is a release requirement, not a polish
pass.

## Standards target

The project targets:

- WCAG 2.2 Level AA
- Applicable web-content provisions of the Revised Section 508 Standards

The Revised Section 508 Standards incorporate WCAG 2.0 Level A and AA for web
content. Targeting WCAG 2.2 AA covers those incorporated success criteria plus
newer WCAG criteria, but it does not by itself prove full Section 508
conformance. Section 508 also includes scoping, functional-performance, support,
and documentation considerations.

This is an independent site, not a federal information system. It is being
evaluated against these standards because California Government Code §7405
requires state governmental entities developing, procuring, maintaining, or
using information technology to comply with Section 508 accessibility
requirements. That context makes 508 readiness strategically and practically
relevant; it does not make this repository an official or certified system.

## Release requirements

- Semantic page regions and heading hierarchy
- Skip link and visible keyboard focus
- Native, persistently labeled filter controls
- Source-role and analytical-relationship layers remain consecutive and
  text-complete without their decorative rails
- Status and timing communicated with text, not color alone
- Search-result changes announced through a restrained live region
- No hover-only information or keyboard traps
- Content remains usable at 200% zoom and narrow viewport widths
- Reduced-motion preference respected
- Source, reviewed-evidence, and analytical layers named in text and structure
- Data downloads have plain-language descriptions and stable formats
- Errors and empty states explain the next available action

## Last manual review

**Reviewed 2026-07-13, at commit `ef1d11b`.**

That is the date and commit at which this status was last written. The Atlas
dates every source, retrieval, evidence record and watchlist review; this is
that date for the Atlas's own evaluation, and it is deliberately stated the same
way — as a review that happened once, on a build that no longer exists, rather
than as a property of "the current development build".

What that review covered:

1. **Static checks:** lint rules, source-data validation, and rendered-HTML
   assertions for language, titles, skip navigation, main regions, layer labels,
   and the result-count live region.
2. **Automated review:** representative-route scans and programmatic spot checks
   for focus order, reduced motion, color tokens, and 320-CSS-pixel reflow.

**Limit of that record:** the scans in (2) were a one-off. The tooling, the
exact route list and the results were not recorded, and there is no accessibility
tool in `package.json` or in the CI gate, so they cannot be re-run or reproduced
today. The rendered-HTML assertions in (1) are real and do run on every build —
they cover page language, `<title>`, the skip link, the `main` landmark and the
result-count live region on the routes they assert — but they are not the
representative-route scans or the focus-order, reduced-motion, color-token and
reflow spot checks described above, and they are not a substitute for them.

### Routes covered by the 2026-07-13 review

These are the routes that existed at `ef1d11b`, plus the exported 404 page.

- `/`
- `/directives/[id]`
- `/evidence`
- `/handoffs`
- `/methodology`
- `/data`
- `/accessibility`

### Routes not covered by that review

- `/research/tda-ntd` — added 2026-07-13 (`c47f909`)
- `/corrections` — added 2026-07-14 (`64608c6`)
- `/watchlist` — added 2026-07-29 (`bba96c0`)

### Interaction patterns and presentation not covered by that review

Every route in the list above is also affected, because the presentation the
review looked at has since been replaced:

| Change | Date | What is uncovered |
|---|---|---|
| Print affordance on directive records (`0905d4c`) | 2026-07-14 | a new control on every directive page |
| URL-syncing explorer filters (`c47f909`, `79f6113`) | 2026-07-13, 2026-07-17 | focus and live-region behaviour when filters rewrite the URL |
| Register redesign (`f82b0d7`) | 2026-07-22 | 1,111 lines of new CSS plus rebuilt header, footer and directive rows: contrast, focus visibility, reflow and zoom across **every** route |
| Context watchlist layer (`bba96c0`) | 2026-07-29 | a `<details>`/`<summary>` disclosure pattern that was not in scope, on `/watchlist` and on every directive page |
| `sitemap.xml` and `robots.txt` (`0f6f902`) | 2026-08-04 | no user-facing surface |

This list is not a finding that any of it is inaccessible. It is a statement
that it has not been evaluated, which is the only claim the record supports.

### Keeping this honest

This review is manual, and it stays manual until there is a real automated pass
to gate. Two things hold the line in the meantime:

- Any pull request that adds a route or an interaction pattern re-runs the
  manual review and updates the date, the commit and the lists above.
- `tests/accessibility-scope.test.mjs` fails when a route in `app/` appears in
  neither list, and when the `/accessibility` page and this document disagree
  about what was covered. A new route cannot quietly inherit an old evaluation.

Pending before any conformance claim:

1. **Keyboard review:** complete user-flow testing in current Chrome, Firefox,
   and Safari, including focus visibility and focus management.
2. **Zoom and low vision:** full 200% and 400% zoom, text-spacing, forced-colors,
   and narrow-width review across every route.
3. **Assistive technology:** VoiceOver and NVDA or JAWS review of the explorer,
   handoff filters, directive detail, evidence index, methodology, and data
   download flows.
4. **Human evaluation:** testing with disabled users and documented decisions
   about external source and evidence-file accessibility, including the
   inaccessible signed source.
5. **Everything shipped since 2026-07-13:** the three routes, the disclosure and
   print patterns, the URL-syncing filters, and the redesigned presentation
   listed above.

Automated results are quality controls, not certification. Until the pending
reviews are complete and exceptions are documented, the project does not claim
WCAG or Section 508 conformance. Any future Accessibility Conformance Report
should identify the exact product version, evaluation method, test environment,
evaluator, and exceptions.

## Known limitation

The signed executive order is published externally as a scanned, untagged PDF
outside this repository and the site evaluation scope. This project provides
semantic HTML summaries, short reviewed excerpts, and page locators to reduce
that barrier, but those are not a complete alternative version and do not alter
or remediate the official source file. The signed source image remains
authoritative.

Reviewed public artifacts are external files and remain outside this
repository's conformance scope. The evidence layer records cautious artifact
metadata and an accessibility note without claiming that a tagged PDF conforms
to PDF/UA, WCAG, or Section 508. Links remain usable even when an external
artifact has accessibility limitations.

## Primary references

- [Section 508 web-content overview](https://www.section508.gov/test/websites/)
- [Revised 508 applicability and conformance](https://www.section508.gov/develop/applicability-conformance/)
- [ICT Testing Baseline for the Web](https://ictbaseline.access-board.gov/web-baselines/)
- [California Government Code §7405](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=7405)
