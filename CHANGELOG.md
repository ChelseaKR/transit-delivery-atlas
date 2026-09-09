# Changelog

All notable changes to source extraction, evidence, analysis, and interface behavior are
recorded here.

## [Unreleased]

### Added

- **A dated, record-level change log, and an Atom feed of it.** The Atlas had no way
  for a reader to learn that it had learned something without loading the site and
  comparing it with what they remembered. `/changes.xml` is an Atom 1.0 feed and
  `/changes.json` the same entries as data, with a filtered feed per directive at
  `/directives/<id>/changes.xml`. The site has no accounts, no analytics and no
  subscriptions by design, and a static feed is the one push channel that keeps all
  three true.

  Entries are derived, not written: review sweeps and the evidence records each sweep
  added, re-reviews on both curated layers, cited-artifact re-checks read from the
  verification log rather than a second retrieval path of their own, context-watchlist
  re-reviews and narrowings, calculated planning dates the build date has reached, and
  planned review dates the build found had passed. `data/changes.json` carries only the
  two kinds of event the data cannot infer -- a correction, and a narrowing -- and is
  empty until one occurs.

  Three rules make it a record rather than a narrative. An entry says what the Atlas
  did and never what a named body did, and every entry is screened through the same
  verdict lexicon the published pages are. An entry that names a record the dataset
  does not hold fails the release gate rather than being dropped, because a shorter
  feed says nothing about why it is shorter. And `observedBy` separates the two kinds
  of date: `data` entries do not move when the site is rebuilt, while a `build` entry
  is that build's own observation of an absence, which is the only honest date a lapsed
  review can carry -- the lapse is the missing record, and a missing record has no date.

  A `watchlist-boundary-checked` kind was written and then removed: the release gate
  holds `evidenceBoundary.checkedOn` equal to `lastReviewedOn`, so it could never
  produce an entry the review entry did not already carry on the same date. The rule
  check is folded into the review entry instead, and a dataset where the two dates
  disagree fails rather than publishing one date for both.

- **The evidence layer's hashes are now re-checked, not merely stored.** Every evidence
  record carried a SHA-256 so a quotation could be verified against the publisher's own
  file, and nothing had ever re-read that hash after the review. Link rot or a silent
  re-issue would have left the register asserting a relationship to bytes that no longer
  exist, with every gate green. `npm run evidence:verify` re-fetches each artifact and
  context URL and classifies the record `intact`, `changed`, `moved`, or `gone`; the run
  is committed as `data/evidence-verification.json`, `scripts/validate-data.mjs` requires
  it to cover every record with the URLs those records cite, and every page that renders an
  evidence card renders the date of the last re-check with it.

  A context URL is never called `intact` — nothing is stored to compare it against — and a
  run in which no URL answered is reported as a run that could not happen rather than as
  every artifact having disappeared. Nothing is edited automatically: a record whose
  artifact is gone keeps its place and its review date, and `--draft-limitations` prints
  the sentence it would carry for a person to paste.

  First real run, 2026-09-06: all four cited artifacts still hash to the bytes reviewed
  for them, and all four context URLs answered.

### Fixed

- **The changelog announced a record page the site does not serve.** A twenty-line
  `[Unreleased]` entry stated that every body the order names now has its own record page,
  that the site lists the registry alphabetically under a record-page route, and that an
  organizations export joins the other CSVs. None of it is on `main`: there is no
  organizations route under `app/`, none in `app/sitemap.ts`, and no such CSV in
  `public/data/`. The feature is real and is on an unmerged branch; the entry reached `main`
  through a changelog conflict resolved in the other direction, inside a pull request whose
  own diff contained not one line of it. Both branches were green throughout, because an
  `[Unreleased]` paragraph is not a thing anything read -- `.github/workflows/quality.yml`
  runs no job for a docs-only change, and `published-figures.test.mjs` holds the docs'
  *numbers* to the data and their prose to nothing.

  The entry is removed here rather than corrected, because it is not wrong about the branch
  it was written for; it is on the wrong branch. It returns when that branch does.

  `tests/changelog-claims.test.mjs` re-derives the check: every route the `[Unreleased]`
  section names in backticks must be one the built `out/` artifact actually serves,
  resolved against the export rather than against the source tree for the reason
  `release-artifact.test.mjs` uses it -- a route is a fact about what was built. Backticks
  are the convention it keys on, and it is stated as a convention rather than implied: this
  file writes every path in backticks, so a backticked route is an announcement, and prose
  that names a route as an example of a wrong claim is not one. It is deliberately the cheap
  half. It asks whether an announced page is reachable, never whether the page contains what
  the sentence claims, so a sentence can still be wrong about a page that exists.

  On the tree before this change it named the route and failed. Two floors keep it from
  passing over nothing: it refuses when `out/index.html` is absent, and it asserts the
  resolver can still find three routes the build always writes -- otherwise a resolver that
  stopped matching would report every route as unserved and blame the changelog, and an
  extractor that stopped matching would report an empty list and read as clean.

- **The directive page cited artifacts without publishing whether they still resolve.** The
  link-integrity check landed on the evidence index only. The directive page renders the same
  records, from the same log, in the same `evidence-meta` list, and carried no integrity line
  at all — so the half of the fix that tells a reader a citation has drifted reached one of
  the two surfaces that publish the citation.

  Measured on a build with one record's artifact marked `changed`: `/evidence` published
  "Artifact last re-checked Sep 6, 2026 — hash is …, the reviewed artifact hashed …", while
  `/directives/n-7-26-5` rendered the identical card with nothing said and still offered
  "Open public record" beside it. Same record, same build, two different answers to whether
  the citation still resolves. All four cited artifacts hang off that one directive page, so
  the surface that was silent is the one carrying every citation the register makes.

  The row is now one shared `components/ArtifactIntegrityRow.tsx` used by both pages, rather
  than a second copy of the same nine lines — a second copy is exactly what this defect was.
  A record the log does not cover still renders no line at all, on either surface. The new
  screen in `tests/rendered-html.test.mjs` derives the surfaces from the data, so a new
  record or a new citing directive is covered the day it lands, and requires each page to
  publish the outcome the log actually records rather than merely showing the row.

- **A quotation past page nine was published with the wrong page.** The page markers this
  project writes into the retained text were matched with `\d`, not `\d+`, in both
  `pageOfQuote` and `quoteIsVerbatim`. On the five-page signed order that is inert; on the
  first instrument longer than nine pages it is not. `pageOfQuote` stopped recognising
  markers at `=== PAGE 10 ===` and carried the last page it had matched forward, so a
  quotation on page 11 was located on **page 9** — a wrong locator, not a missing one, in
  the one field a reader uses to check a quotation against the signed image. Measured on a
  synthetic twelve-page instrument before the fix. `quoteIsVerbatim` had the same shape:
  markers past page nine survived into the haystack a quotation is matched against.

  The pattern is now declared once, beside the corpus directory, with each use carrying
  its own flags — a `g`-flagged regex is stateful, and sharing one object between a
  `replace` and a `split` would be a bug of a different kind. `tests/corpus.test.mjs`
  builds a twelve-page instrument, because nothing in the committed corpus can exercise
  this. Relevant to the multi-instrument work: a longer statute or trailer bill is exactly
  where this would first have been noticed, by being wrong.

- **A source that had never been checked was reported as checked today.**
  `nextCheckSentence` passed `coverage.lastCheckedOn ?? buildDate` into `reviewCurrency`,
  substituting the build date for a coverage record whose listed sources have never been
  successfully checked. `reviewCurrency` duly reported `daysSinceReview: 0` — "checked
  today" for something never checked. Nothing renders that field today, so the published
  sentence was right by luck rather than by construction, and the next reader of it would
  have been wrong.

  `reviewCurrency` now accepts `lastReviewedOn: null` and reports `daysSinceReview: null`,
  so absence travels through as absence instead of arriving as a zero. The planned date
  still expires on its own terms; only the review *age* is unknown, and it says so.

### Added

- **The exports now carry their own contract.** `public/data/datapackage.json` is a
  Frictionless Data Package describing every published file: a Table Schema per CSV
  giving each column its name, type and whether it is ever empty, the separator a
  multi-valued cell uses, the licence split, and the signed source's retrieval date and
  SHA-256. `public/data/dcat.jsonld` is the same dataset as a DCAT-AP record for catalog
  harvesters. Both are generated at build by `scripts/export-data.mjs` and byte-compared
  against the committed copies by `npm run data:export:check`, like every other export.

  Every field in every Table Schema is **derived from the rows actually written**, never
  authored beside them. A hand-maintained schema is a second copy of the truth and a
  second copy drifts — this repository has already published one figure that described
  an older build than the one printed next to it. `tests/data-package.test.mjs` re-reads
  the published CSV bytes the way a consumer would and asserts that every declared column
  name, order, type and `required` constraint holds for every row, so a column that
  changes shape fails in the same commit.

  Two things are deliberately absent. The **build commit** is not embedded: the package
  is byte-compared, so a value that moved with every commit would fail the gate on every
  pull request and teach everyone to regenerate without reading. It is published per
  build at `/version.json` and the package points there; the dataset is dated by
  `dataReviewedThrough`, a real review date read off the records. And a **single SPDX
  identifier** is not used, because the licence genuinely is split: CC BY 4.0 covers the
  analytical content, and the signed order's excerpts, agency names and government
  publications are not relicensed by this project. Naming only CC BY 4.0 at the top would
  be a claim about the source layer this project is not entitled to make.

- `docs/DATA-CARD.md`, stating the dataset's classification (public information only, no
  personal data), provenance, update cadence, licence split and known limitations, linked
  from the `/data` page. It copies no number out of the data: counts and review dates
  live in the exports, and the card names the field that holds each one. With it, the
  Data Governance row of the standards conformance table moves from partially met to met.

### Fixed

- Two commits reached `main` with no CI verdict at all. `quality.yml` keyed its
  concurrency group on `github.ref` alone, so every push to `main` shared one group;
  with `cancel-in-progress: true`, each merge cancelled the run still executing for
  the merge before it. On 2026-09-06 that left `afb757e2` (#116) and `0b9b1ada` (#119)
  on `main` with `validate` recorded as `cancelled` and no other check — and a
  cancelled run is not a pass, it is no verdict. `main` read as green only because the
  tip's run happened to be the one that survived. The key now appends the commit SHA on
  push, so each commit gets its own run; pull requests still collapse onto the branch
  ref, which is the cancellation that was wanted.

- The release gate regenerated the committed exports instead of checking them.
  `npm run check` calls `npm test`, which calls `npm run build`, which calls
  `npm run data:export`, so every local run of the documented gate rewrote the
  ten tracked files under `public/data/` and then reported success. A stale
  export could not fail: the only thing in the gate that touched those files was
  the thing that would have repaired them first. Only
  `.github/workflows/quality.yml` compared anything, and that workflow skips
  itself on a docs-only change and is not the workflow that deploys or releases,
  so `deploy.yml` and `release.yml` could both ship a commit whose committed
  exports were not what the data produced. `scripts/export-data.mjs --check`
  now writes nothing: it builds the same ten bodies and compares them to what is
  on disk, naming every file that differs or is missing. `npm run check` runs it
  first, before the build can rewrite anything, which is the same reason a
  lockfile check runs before the steps that would resolve it. It also reports a
  file that was never committed, which `git diff --exit-code` cannot see. The
  exports had not drifted.

- `docs/BRAND.md` sketched a home page that no longer exists. Its layout sketch
  read "21 directives · 2 records" and drew "E 2" against directive 5, both
  hand-copied from figures `app/page.tsx` renders live from `data/evidence.json`.
  The evidence collection has held four records, all four linked to directive 5,
  since before this entry. Nothing read either number back, and
  `.github/workflows/quality.yml` ignores `docs/**`, so a change to that file
  ran no job at all. `tests/published-figures.test.mjs` now re-derives them, and
  the six counts in `docs/RELATIONSHIP-MODEL.md` alongside them. Two of those
  six, "15 unique directive pairs" and "12 of which are reciprocal", appeared
  nowhere else in the repository: no other test, no other document, no code
  path. They were correct and they were the only published figures here with
  nothing whatever behind them.

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
- Every string the site publishes as the order's own words is now verified
  against the retained corpus. `tests/corpus.test.mjs` is titled "every
  reviewed excerpt in the source layer is verbatim in the corrected text" and
  checked twenty-four `excerpt` fields. The directive page also publishes 35
  `qualifiers[].text` under the heading "Qualifiers preserved from the source"
  and 8 `timing[].sourceText` phrases as what the order states, and nothing
  verified any of the 43: `qualifierSchema` accepts any non-empty string, the
  data-integrity suite checks only that it is a string, one of the 35 is spot
  checked against a literal in `scripts/validate-data.mjs`, and
  `service/knowledge.ts` never registers them, so the runtime quotation
  verifier never sees them either. A fabricated qualifier passed the entire
  release gate and shipped under a heading promising it came from the source.
  The quotation set is now derived from the data, so a new qualifier is covered
  the day it lands, and asserted non-empty, because a check that verifies
  nothing passes forever.
- The zero-tolerance eval gate no longer takes the audited file's word for it.
  `tests/eval-results.test.mjs` read `zeroTolerance` from the result file it
  was auditing, while the committed case file is what actually declares it.
  A result could drop the flag, record eight refusal failures in the suite
  AGENTS.md calls "zero tolerance", and pass. The committed case file is now
  the authority, and a result contradicting it is rejected.
- The same test derived its work set from `evals/results/`, so an empty
  directory validated nothing and passed — and deleting the five files was an
  easier way to satisfy the prompt-version freshness gate than re-running the
  suites. The work set is now the five committed case suites: a suite with no
  result file fails, a result with no case file fails, and a suite that was not
  run live must still say so rather than going missing.
- The sitemap check now derives the site's routes instead of copying them.
  `tests/hosting.test.mjs` is named "sitemap lists every static route and every
  directive record exactly once", and its directive half was properly derived
  from `data/directives.json` while its static half was a nine-element literal
  identical to the one in `app/sitemap.ts` — a constant compared against a copy
  of itself, able to fail only if someone edited one copy and not the other.
  Adding a route and not updating `app/sitemap.ts` published the page unindexed
  with the whole gate green, including the accessibility scope checks a new
  route does correctly trip. Routes now come from `app/**/page.tsx`, the same
  derivation `tests/accessibility-scope.test.mjs` already uses.
- `coverageStatement` no longer publishes the literal word "null" (#74). The
  `"linked"` coverage state is derived from `evidenceCount > 0` alone, so a
  directive can carry linked evidence while `checkedSources` is empty — most
  reachably when the only review source listed as covering it had its retrieval
  fail. `lastCheckedOn` is then `null` and was interpolated straight into
  published prose: "The 0 listed public sources covering it were last checked
  on null." Nothing threw, so a bad build shipped silently, and the same value
  feeds the answer verifier's freshness block. The statement now says no check
  date is available, and `scripts/validate-data.mjs` separately refuses the
  data-modelling error behind it: an evidence record linking a directive that
  no review source lists in `coversDirectiveIds`. A retrieval failure is left
  to the renderer, because failing the release on it would block a deploy for
  something no re-review can clear.
- The status-key screen now reads the whole published dataset. It ran over
  `{ evidenceScope, evidence }` — a two-key slice of a ten-key document —
  leaving `directives`, `organizations`, `themes`, `orderMetadata` and `source`
  unscreened in the exports readers actually download. The canonical files are
  covered by `rejectStatus` and by strict schemas, so the gap only opens where
  `scripts/export-data.mjs` assembles derived fields; `data/public-schema.json`
  catches an unexpected key by shape, but a schema widened to admit one is a
  normal act and nothing then re-checked the policy. With the schema permitting
  it, all twenty-one published directives carried a `status` field and the
  release gate stayed green. The published `directives.json`, `watchlist.json`
  and `tda-ntd-feasibility.json` are now screened whole, with the document's key
  count asserted so the screen cannot quietly narrow again.

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

- Ko-fi support link in the site footer, using a self-hosted copy of the button
  image so the page makes no third-party request and stays within the site's
  `img-src 'self' data:` content-security policy
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
