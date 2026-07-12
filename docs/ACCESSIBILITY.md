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
- Status and timing communicated with text, not color alone
- Search-result changes announced through a restrained live region
- No hover-only information or keyboard traps
- Content remains usable at 200% zoom and narrow viewport widths
- Reduced-motion preference respected
- Source and analytical layers named in text and structure
- Data downloads have plain-language descriptions and stable formats
- Errors and empty states explain the next available action

## Current evaluation status

Completed on the current development build:

1. **Static checks:** lint rules, source-data validation, and rendered-HTML
   assertions for language, titles, skip navigation, main regions, layer labels,
   and the result-count live region.
2. **Automated review:** representative-route scans and programmatic spot checks
   for focus order, reduced motion, color tokens, and 320-CSS-pixel reflow.

Pending before any conformance claim:

1. **Keyboard review:** complete user-flow testing in current Chrome, Firefox,
   and Safari, including focus visibility and focus management.
2. **Zoom and low vision:** full 200% and 400% zoom, text-spacing, forced-colors,
   and narrow-width review across every route.
3. **Assistive technology:** VoiceOver and NVDA or JAWS review of the explorer,
   directive detail, methodology, and data download flows.
4. **Human evaluation:** testing with disabled users and a documented decision
   about the inaccessible external source PDF.

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

## Primary references

- [Section 508 web-content overview](https://www.section508.gov/test/websites/)
- [Revised 508 applicability and conformance](https://www.section508.gov/develop/applicability-conformance/)
- [ICT Testing Baseline for the Web](https://ictbaseline.access-board.gov/web-baselines/)
- [California Government Code §7405](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=7405)
