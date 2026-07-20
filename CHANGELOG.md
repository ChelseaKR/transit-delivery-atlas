# Changelog

All notable changes to source extraction, evidence, analysis, and interface behavior are
recorded here.

## [Unreleased]

### Added

- Shareable explorer URLs for the delivery-relationship views: the named-bodies
  and inferred-dependency filters on the handoffs page now sync to the URL
  (namespaced query parameters so the two explorers never collide), so a
  filtered view can be linked and survives reload, matching the directive
  explorer
- Printable directive brief: a "Print this record" button on each directive
  detail page triggers the browser print dialog, using the existing print
  styles to produce a clean, chrome-free brief of the source excerpt, evidence,
  and analysis. The button is hidden in the printout.
- Public correction and review chooser with structured GitHub issue forms for
  source-backed changes and observed usability or research findings

### Changed

- Relicensed code MIT → Apache-2.0 (explicit patent grant; prior released
  snapshots remain MIT): `LICENSE` replaced with the canonical Apache License
  2.0 text, `NOTICE` added, and `package.json`, `CITATION.cff`, README, and the
  code-license cross-reference in `CONTENT-LICENSE.md` updated to match. The
  content and data license (CC BY 4.0, `CONTENT-LICENSE.md`) is unchanged
- Set page-level headlines in sentence case while retaining uppercase for
  compact wayfinding and data labels

## [0.4.0] - 2026-07-13

### Added

- Shareable explorer URLs for search, theme, named lead, and timing filters
- Cited four-field TDA/NTD reporting feasibility page and JSON export
- Repeatable expert-review and lightweight usability-test guide

## [0.3.0] - 2026-07-13

### Added

- Accessible potential-handoff view with all 23 named body/group records, 50
  explicit source-role links, 21 inferred dependency statements, and 27
  analytical cross-references
- Separate native-filter experiences for signed-source roles and independent
  analytical relationships, including coverage-safe empty states
- Normalized `directive-organizations.csv` and
  `directive-relationships.csv` exports derived from canonical records
- Relationship-model documentation defining provenance, semantics,
  accessibility, and review boundaries

### Changed

- Added relationship navigation and homepage entry points
- Added fail-closed checks for duplicate themes and related IDs,
  dependency self-links, and out-of-document-order cross-references
- Expanded data, methodology, contribution, accessibility, and product
  documentation for the relationship release
- Kept the canonical JSON contract at schema version 0.2.0 because the new CSVs
  normalize existing fields without changing the JSON shape

## [0.2.0] - 2026-07-13

### Added

- Selective reviewed-public-evidence layer with provenance, exact citations,
  locators, hashes, review dates, accessibility notes, and explicit limitations
- First reviewed record: California Transportation Commission reference
  material explicitly citing Order 5, with July 15 labeled as a scheduled event
- Evidence index, directive-level evidence cards, safe empty states, and a
  separate evidence CSV export under public schema version 0.2.0

### Changed

- Expanded the handoff model and methodology from two to three structural layers
- Added fail-closed validation and rendered-output checks for evidence links,
  selective coverage, scheduled dates, and status-like fields

## [0.1.0] - 2026-07-13

### Added

- Initial source model for Executive Order N-7-26
- Independent analytical crosswalk and machine-readable exports
- Accessible directive explorer, methodology, and data documentation
