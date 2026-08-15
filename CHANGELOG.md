# Changelog

All notable changes to source extraction, evidence, analysis, and interface behavior are
recorded here.

## [Unreleased]

### Fixed

- The verdict lexicon now screens the published site, not only the optional AI
  service. `lib/verdict-language.mjs` describes itself as "the single list
  shared by the verifier that screens model output, the pre-classifier that
  refuses verdict questions, the evaluation harness, and the tests, so no
  surface can carry a different idea of 'verdict'" — and every one of those
  consumers screened the question-answering layer. None screened the static
  pages, which is the surface nearly every reader gets and the one built from
  hand-written prose in `data/`. AGENTS.md states the rule as applying
  "anywhere a reader can see them, including AI output"; the site was the half
  that was never checked, so "Caltrans is behind schedule" could have shipped
  in an analysis summary with a green gate. `tests/published-verdict-language.test.mjs`
  now reads every exported page — all thirty-three, including all twenty-one
  directive pages — plus the `aria-label`, `alt` and `title` text assistive
  technology announces, and fails on any verdict sentence without a registered
  reason. The sixteen sentences the site legitimately publishes while
  disclaiming them ("it does not establish completion, compliance, or agency
  performance") are registered in `lib/published-language.mjs` with the reason
  each is not a finding; a registered sentence the site stops publishing fails
  the gate too, so an exemption cannot outlive the prose that earned it.
- The service's facts-document screen now covers all twenty-one directives.
  `tests/service-pipeline.test.mjs` asserted that the assembled prompt carries
  no status words, over two directive IDs written as literals, leaving the
  other nineteen analysis summaries able to hand the model a verdict to
  narrate. The set is now derived from the loaded knowledge and pinned at
  twenty-one.

### Changed

- The "Ask about this directive" panel is now gated at build time on
  `NEXT_PUBLIC_ASK_ENDPOINT`. A build with no question service configured —
  which is every build today, since the service is not deployed — renders no
  panel, no button, and no input on any directive page, rather than an
  affordance whose only possible reply is that no service exists. A reader
  invited to ask a question has already been told something untrue by the time
  an error string explains the invitation was empty. `tests/ask-gate.test.mjs`
  pins both directions: absent across all twenty-one directive pages in the
  ordinary build, present and labelled in a second isolated build with the
  variable set. Turning the panel on is now explicitly part of deploying the
  service (`docs/AI-SERVICE.md`).

### Added

- "Ask about this directive": an explicit opt-in AI panel on each directive
  page. Until a reader opens it and submits a question the page performs no
  request of any kind (`lib/ask-client.ts` is constructed with an injectable
  fetch and `tests/ask-client.test.mjs` proves the zero-requests-before-opt-in
  property); the endpoint is a same-origin path, so the CSP's
  `connect-src 'self'` is unchanged. Every answer renders with the
  AI-generated/unofficial/not-a-compliance-determination label, quotation
  blocks that link back to the signed PDF page, the withheld-claims count, and
  provenance; a missing service, a rate limit, and a provider outage each
  render as a contained notice that leaves the record intact.

- The runtime question-answering service under ADR-0002 (`service/`): a
  deterministic verdict lexicon that refuses compliance/status/grading
  questions before any model call, model-based question structuring re-checked
  against the directive index, facts assembled by the service from `data/` and
  `corpus/`, narration that can reference quotations and evidence records only
  by ID, and a verifier that checks every quotation verbatim against the
  retained corpus, withholds verdict sentences, inserts the site's own
  empty-state and freshness blocks by construction, and reports the withheld
  count. Anthropic API (`claude-sonnet-5` default) or Amazon Bedrock via the
  same SDK family; per-client and global rate caps; logs carry counts, never
  question text. See `docs/AI-SERVICE.md`.
- The evaluation harness (`evals/`): five committed suites — compliance
  refusal (zero tolerance), empty-state fidelity, citation grounding,
  freshness disclosure, and question structuring — run against the real
  pipeline, with result files accepted only from live runs carrying provider,
  model, prompt version, commit, and date (`tests/eval-results.test.mjs`).
- The first live evaluation results (`evals/results/`), run 2026-08-22 against
  `global.anthropic.claude-sonnet-4-6` on Amazon Bedrock at prompt version
  `2026-08-21.1`: compliance refusal 48/48 and empty-state fidelity 20/20, both
  zero-tolerance suites, with no status language published in any answer;
  freshness 10/10; citation grounding 15/15 with 21 quotations verified
  verbatim against the retained corpus; question structuring 20/22, the two
  failures being refusals to guess a directive from a topic name rather than
  wrong answers. The configured default model `claude-sonnet-5` is not entitled
  on the account used, so every result file records Sonnet 4.6 as the model
  that produced it.

- ADR-0002 records an owner-directed change of direction: an optional runtime
  question-answering layer, with the model kept at the edges (it structures a
  question and narrates facts the service assembled) and a verifier before
  display that checks every quotation of the order against the retained corpus,
  resolves every evidence citation, withholds verdict language, and inserts the
  site's own empty-state wording. `AGENTS.md` states the working rules.
- The retained corpus `corpus/eo-n-7-26/`: the official signed PDF
  (byte-identical to the hash in `data/sources.json`), a raw macOS Vision OCR
  of the scan, a reviewed corrections log (26 entries, each with its basis), the
  corrected text, and a manifest with hashes and retrieval date.
  `lib/corpus.mjs` verifies a quotation verbatim (with elision support) and
  `tests/corpus.test.mjs` proves all 24 reviewed source excerpts appear in the
  corrected text on the pages their locators name.

- The evidence layer now carries a forward review commitment (#59). Data
  contract 0.3.0 adds `nextReviewOn`, a `reviewCommitment`, a committed
  `reviewSources` list (each with the directives it covers, a last-checked date,
  and whether the check succeeded), and a dated `sweeps` log to
  `evidenceScope`. The next review date expires against the build date under
  the same grace-window rule as the watchlist, so an evidence sweep that lapses
  blocks a release the same way a lapsed watchlist review does. Each directive
  page now says which of two things its empty evidence list means — the listed
  sources were checked on a stated date and found nothing, or no listed source
  has been successfully checked yet — and `/evidence` publishes the source
  table and sweep log (`lib/evidence-coverage.mjs`).
- Two evidence records from the first recorded sweep (2026-08-21): the
  California Transportation Commission's August 20–21, 2026 book items
  recommending adoption of the 2026 Solutions for Congested Corridors Program
  guidelines (Resolution G-26-60) and the 2026 Local Partnership Competitive
  Program guidelines (Resolution G-26-64), both of which state that criteria were
  amended "Pursuant to Executive Order N-7-26 (Order #5)". Both are staff
  recommendations published 2026-08-07; neither is an adoption record.

### Changed

- The two Commission watchlist leads whose planned reviews had lapsed were
  re-reviewed on 2026-08-21. The August 3 North Hearing lead records that the
  Commission's later book items say the hearing occurred, and the August 20–21
  meeting-page lead now watches for minutes and adopted resolutions, since the
  book items that cite the order moved to the evidence register.

- Calculated planning dates now expire against the build date. The register's
  timing column and each record page carried a bare derived date with no
  reference point, so a build served after the date would keep presenting it as
  something still ahead — the same defect the context watchlist's planned review
  dates were fixed for, on the dates seven of the twenty-one directives share
  (2026-10-24) and the one-year date on `1(e)` (2027-06-26). A passed date is
  flagged in the register, both surfaces state how far the date sits from the
  build that published them, and the release gate reports the count. Deliberately
  bounded: the wording states arithmetic on the order's own language and refuses
  "late", "missed", and "out of compliance", and a passed date never fails the
  gate — a lapsed watchlist review is an upkeep defect a re-review clears, while
  a date arriving is neither (see `lib/directive-timing.mjs` and
  [the methodology](docs/METHODOLOGY.md))

## [0.5.0] - 2026-08-16

Most of this section was already sitting under `[Unreleased]` when `v0.4.0` was
tagged: that tag moved only its own three July 13 entries into a version
section and left the rest behind. So this section is the accumulated backlog
plus the thirteen commits since `v0.4.0`, not thirteen commits' worth of work.
The `v0.4.0` site build already contained the earlier items.

- Release publication now begins from reviewed `main` through the immutable
  portfolio authorizer, builds the exact verified site commit without a
  dependency cache, and hands the archive to a checkout-free publisher that
  rechecks the tag object.

### Added

- Weekly `release-authorization` check over the release workflow's
  cross-repository authorization dependency: it asserts the reference is pinned
  to a commit SHA, that the host repository is usable from a public caller, that
  the pinned commit and workflow file still resolve, that the `workflow_call`
  contract still declares the outputs `release.yml` consumes, and that the
  caller-side allowed-signers file the reusable workflow requires is present. An
  unresolvable reference is rejected at dispatch with HTTP 422 and never creates
  a run record, so until now the only way to discover a broken authorization
  reference was to try to cut a release
- Generated `sitemap.xml` (all static pages plus every directive record) and
  `robots.txt` (allows crawling, points to the sitemap) so search engines can
  discover and index the full public site; both are covered by rendered-output
  and CloudFront routing tests
- Separate context watchlist with five reviewed official-source leads, explicit
  evidence-boundary reasons, editorial directive relationships, next-review
  dates, and limitations; the new `/watchlist` page and directive-level asides
  remain visibly outside the Source/Evidence/Analysis provenance triplet
- Independent versioned watchlist JSON, CSV, and JSON Schema exports with
  fail-closed validation for dates, URLs, directive references, evidence URL
  overlap, boundary checks, and status-like fields
- Internationalization declaration naming the owner, first localized product
  boundary, source-language protections, fallback behavior, and review
  deadline without claiming catalogs or translated copy already exist
- Shareable explorer URLs for the delivery-relationship views: the named-bodies
  and inferred-dependency filters on the handoffs page now sync to the URL
  (namespaced query parameters so the two explorers never collide), so a
  filtered view can be linked and survives reload, matching the directive
  explorer
- Printable directive brief: a "Print this record" button on each directive
  detail page triggers the browser print dialog, using the existing print
  styles to produce a clean, chrome-free brief of the source excerpt, evidence,
  and analysis. The button is hidden in the printout.
- Ko-fi support link in the site footer, using a self-hosted copy of the button
  image so the page makes no third-party request and stays within the site's
  `img-src 'self' data:` content-security policy
- Public correction and review chooser with structured GitHub issue forms for
  source-backed changes and observed usability or research findings
- Post-workshop California Transportation Commission presentation documenting
  the Order 5 basis, proposed SCCP and LPP-C language, current guideline-cycle
  boundary, exact page locators, artifact hash, and adoption-safe limitations

### Changed

- Completed the README Standards Conformance table. It declared eleven of the
  fifteen portfolio standards and silently omitted Performance, AI Development
  Measurement, Incident Response, and Data Governance; all four apply to this
  repository. The four missing rows are added with their real current state
  rather than a placeholder, and the section now states plainly that the
  standards are neither vendored nor pinned here, so the table is a declaration
  of applicability rather than a checked result
- Replaced the promotional operations-board interface with a compact public
  research register: the home page now leads with the directive records,
  filters are horizontal, source/evidence/analysis coverage is visible in each
  row, navigation is simplified, and document pages use restrained headers and
  flat evidence layers
- Reworked the footer into a compact, high-contrast provenance band with
  grouped navigation and separate correction and signed-source actions
- Relicensed code MIT → Apache-2.0 (explicit patent grant; prior released
  snapshots remain MIT): `LICENSE` replaced with the canonical Apache License
  2.0 text, `NOTICE` added, and `package.json`, `CITATION.cff`, README, and the
  code-license cross-reference in `CONTENT-LICENSE.md` updated to match. The
  content and data license (CC BY 4.0, `CONTENT-LICENSE.md`) is unchanged
- Set page-level headlines in sentence case while retaining uppercase for
  compact wayfinding and data labels
- Re-reviewed the earlier Order 5 reference material after the July 15 workshop
  and replaced its future-event limitation with a link-safe distinction between
  the pre-workshop artifact and later posted presentation and recording
- Updated Next.js to 16.2.11 and pinned its optional Sharp dependency to 0.35.3
  so release checks include the patched production dependency set

### Fixed

- Updated Next.js to 16.3.0 and re-pinned its nested PostCSS override to
  8.5.25, closing a moderate `postcss` advisory (GHSA-fxqj-rqcc-2cmp,
  incomplete-fix follow-up to GHSA-6g55-p6wh-862q) that had started failing
  `npm run audit:production` on `main` and blocking the Quality and Deploy
  gates; `npm audit --omit=dev --audit-level=moderate` now reports zero
  vulnerabilities
- The `/data` page's "Reuse and corrections" section still said "Code is MIT
  licensed" after the code license moved to Apache-2.0; it now matches
  `LICENSE`, `CONTENT-LICENSE.md`, and the README. A rendered-HTML check now
  covers this route directly, and a second check scans every exported page so
  a stale license mention on any route fails the release gate instead of
  shipping silently

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
