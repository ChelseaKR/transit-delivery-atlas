# Product requirements: Transit Delivery Atlas v0.2

**Status:** Implementation in progress
**Target release:** July 2026
**Primary source review date:** July 12, 2026
**Evidence review date:** July 13, 2026
**Live product:** [transit.chelseakr.com](https://transit.chelseakr.com)
**Source repository:** [github.com/ChelseaKR/transit-delivery-atlas](https://github.com/ChelseaKR/transit-delivery-atlas)

## Problem statement

Executive Order N-7-26 spans planning, grants, permitting, shared technology,
environmental review, reporting, and interagency coordination. The signed order
is authoritative but difficult to scan as a delivery system: readers must infer
which organizations are explicitly named, which timing clauses apply, and where
the order leaves implementation decisions open.

Transit program staff, policy analysts, advocates, and vendors need a compact,
source-linked crosswalk that preserves the difference between what the order
says and what an independent analyst infers. Without that separation, secondary
summaries can accidentally invent deadlines, owners, progress, or obligations.

## Product thesis

The atlas should answer five questions without claiming implementation status:

1. What does the order direct?
2. Which organizations does it explicitly name?
3. What timing language is explicit?
4. Which dated public artifacts have been reviewed, and why are they connected
   to a directive?
5. What delivery dependencies and open questions follow as analysis?

## Goals

1. Represent all 21 actionable directive units with stable IDs and official
   section locators.
2. Make source facts and analytical inference visually and structurally
   distinct on every page and in every export.
3. Let a reader find a directive by theme, named lead organization, timing, or
   free-text query in under 30 seconds.
4. Publish deterministic JSON and CSV exports that contain the same directive
   set as the interface.
5. Ship with zero known critical data-integrity, build, or serious automated
   accessibility findings.
6. Publish selectively reviewed public evidence without turning evidence
   presence or absence into implementation status.

## Non-goals

- **Implementation status:** no percent complete, traffic lights, lateness, or
  claims about current agency activity.
- **Legal interpretation:** calculated dates are planning conveniences, not
  legal conclusions.
- **A geographic map:** “atlas” refers to multiple navigational views of the
  delivery system.
- **Live monitoring:** v0.2 uses curated source and evidence review, not scraping or
  real-time data.
- **Agency rankings:** the atlas does not grade agencies, staff, or vendors.
- **Reporting automation:** a TDA/NTD field crosswalk is a separately reviewed
  v0.1.1 research slice, not part of the initial release.
- **Personalized advice or generated summaries:** no chat, RAG, or generative AI
  appears in the product.
- **Accounts or analytics:** no authentication, comments, subscriptions,
  trackers, or cookies.

## Users and stories

### Transit program staff

- As a program staff member, I want to see the exact section, named lead, and
  timing language so that I can verify a summary against the signed order.
- As a collaborator, I want qualifiers such as “where feasible” preserved so
  that the crosswalk does not overstate a directive.

### Policy analysts and journalists

- As an analyst, I want source records separated from interpretation so that I
  can cite facts without inheriting unsupported assumptions.
- As a researcher, I want machine-readable exports and stable IDs so that I can
  reuse or critique the classification.

### Advocates and interested residents

- As a reader, I want plain-language summaries and filters so that I can
  understand the order without specialized transportation vocabulary.
- As a reader using assistive technology, I want semantic structure and fully
  labeled controls so that the complete crosswalk is available to me.

## P0 requirements

### P0.1 Source registry

- Store the official title, issuer, issued/effective dates, URL, retrieval date,
  and SHA-256 for the signed source.
- Treat the signed order as controlling over the announcement.

**Acceptance:** build fails if any required source field is absent or the source
ID referenced by a directive is unknown.

### P0.2 Complete directive set

- Include `1(a)`–`1(g)`, `2`, `3(a)`–`3(j)`, `4`, `5`, and `6` in document order.
- Preserve an official section/page locator, short excerpt, named organizations,
  scoped qualifiers, source notes, and timing language for each.
- Mark every record title as editorial, link `3(a)`–`3(j)` to the signed Section
  3 preamble, and retain the order-wide filing and non-enforceability clauses as
  source metadata.

**Acceptance:** validation fails unless the exact expected set of 21 IDs is
present once each.

### P0.3 Timing semantics

- Apply Section 1’s 120-day umbrella to `1(a)`–`1(g)`.
- Show October 24, 2026 only as a calculated calendar-day planning date.
- Give `1(e)` a second milestone: materials completed within one year, with a
  calculated anniversary of June 26, 2027.
- Do not infer deadlines for Sections 2–6.
- Never parse “real time” as a deadline.

**Acceptance:** unit tests cover inheritance, dual milestones, and deadline
absence outside Section 1.

### P0.4 Source/analysis separation

- Store analytical summaries, themes, inferred outputs, dependencies, and open
  questions in a separate file from source extraction.
- Label every expected output and dependency `inferred` and give it a confidence
  level.

**Acceptance:** validation rejects analytical fields in source records and
orphan analytical records.

### P0.5 Explorer

- Default to signed-document order.
- Filter by theme, explicitly named lead organization, and explicit timing.
- Provide free-text search across section, summary, organization, and theme.
- Announce updated result counts through a restrained live region.
- Provide a reset action and useful no-results state.

**Acceptance:** every directive remains discoverable by keyboard and without
relying on color.

### P0.6 Directive detail

- Give each directive a permanent anchor or URL.
- Present “What the order says” before “Analytical crosswalk.”
- Link directly to the signed source and display the section/page locator.
- Phrase deadline absence as “No explicit completion deadline in the signed order.”

### P0.7 Methodology and data access

- Publish methodology, data dictionary, known limitations, correction process,
  changelog, JSON, and CSV.
- Include `schema_version`, source IDs, and review date in exports.

### P0.8 Independence and accessibility

- Display “Independent analysis · Unofficial” above the fold and in the footer.
- Do not use agency logos, seals, state animals, official wrappers, or visual
  imitation of a government website.
- Target WCAG 2.2 Level AA and the applicable web-content provisions of the
  Revised Section 508 Standards, with semantic landmarks, skip link, visible
  focus, reduced motion, equivalent mobile content, and documented manual test
  scope.
- Publish an accessibility statement that distinguishes design targets,
  completed tests, known limitations, and future assistive-technology review.
- Never claim certification, full conformance, or a completed Accessibility
  Conformance Report without the corresponding systematic evaluation.

### P0.9 Reviewed public evidence

- Store dated public artifacts in a third canonical file, separate from signed
  source extraction and independent analysis.
- Require publisher/title provenance, HTTPS URLs, retrieval and review dates,
  SHA-256, media metadata, editorial summary, explicit limitations, and exact
  directive citations with locators.
- Publish collection scope as `selective` with a machine-readable coverage note.
- Render the layer between signed source and analysis on every directive page,
  using a coverage-safe empty state when no reviewed artifact is linked.
- Label future event dates as scheduled and never infer adoption, occurrence,
  completion, compliance, or performance.
- Export evidence as a separate top-level JSON collection and separate CSV.

**Acceptance:** validation rejects orphan or duplicate links, non-HTTPS URLs,
invalid hashes or locators, review-date inconsistencies, and status-like fields;
rendered-page tests verify layer order, scheduled-date wording, and safe empty
states.

## P1 fast follows

- Organization index with explicit relationship labels
- Shareable filter URLs
- Printable directive brief
- Diff view for later source revisions
- Cited four-field TDA/NTD reporting feasibility slice

## P2 considerations

- Additional California transportation directives, only with a clear source
  inclusion policy
- Additional evidence relationship types, only after a documented review policy
- Community correction submissions through repository issues

## Data integrity rules

The build fails closed for duplicate IDs, missing locators or excerpts, unknown
organization/theme IDs, orphan analysis, unresolved dependencies, derived dates
without source timing and method, generated-export drift, or unsupported status
language. Evidence validation also rejects orphan links, invalid hashes and
locators, non-HTTPS URLs, and status-like fields. No mutable implementation-status
field exists in v0.2.

## Success measures

### Release quality

- 21/21 directive units manually checked against the signed order
- 100% of source records have official URL, locator, and review date
- 100% of inferred outputs/dependencies are stored in the analytical layer
- JSON and CSV contain identical directive IDs
- Public evidence JSON and CSV contain identical evidence IDs and directive links
- All automated checks and production build pass

### Early use hypotheses

- At least three external readers use a directive permalink or data download in
  the first 30 days
- At least one substantive correction or domain-expert review is received
- Median observed time to locate a named organization or timing clause is under
  30 seconds in five lightweight usability checks

These are hypotheses, not claims about likely adoption.

## Open questions

- **Policy review:** Should the one-year date in `1(e)` be presented only as an
  anniversary calculation, or should the UI omit the derived date entirely?
- **Data review:** Which TDA and NTD fields have enough official documentation to
  support a defensible v0.1.1 automation classification?
- **Legal/brand:** Is the exact-match domain clear after registrar and trademark
  screening? Preliminary RDAP results are not legal clearance.
- **Accessibility:** Which user-flow checks should supplement automated testing
  after the first public deployment?

## Delivery phases

1. **Data foundation:** source registry, 21 records, analysis layer, validation,
   and exports.
2. **Accessible atlas:** explorer, directive details, methodology, data page,
   and brand system.
3. **Editorial hardening:** independent source/inference review and corrections.
4. **Reviewed evidence:** selective public artifacts, provenance, exports, and
   coverage-safe rendering.
5. **Reporting slice:** cited TDA/NTD research only after evidence review.

Each phase must build successfully and remain independently deployable.
