# Transit Delivery Atlas

> From directive to delivery—making the handoffs visible.

![Transit Delivery Atlas handoff rail from source to entity, timing, evidence, and analysis](public/og.png)

**Project links**

- Live site: [transit.chelseakr.com](https://transit.chelseakr.com)
- Relationship view: [transit.chelseakr.com/handoffs](https://transit.chelseakr.com/handoffs)
- Context watchlist: [transit.chelseakr.com/watchlist](https://transit.chelseakr.com/watchlist)
- TDA/NTD research: [transit.chelseakr.com/research/tda-ntd](https://transit.chelseakr.com/research/tda-ntd)
- Source repository: [github.com/ChelseaKR/transit-delivery-atlas](https://github.com/ChelseaKR/transit-delivery-atlas)

**Transit Delivery Atlas** is an independent, source-linked crosswalk for
California Executive Order N-7-26. It turns each actionable directive into a
navigable record of source language, explicitly named entities, timing,
public-evidence coverage (including explicit empty states), analytical
dependencies, expected outputs, open implementation questions, and a separate
context watchlist for relevant official developments that do not yet qualify as
evidence.

> [!IMPORTANT]
> This is independent public-interest analysis, not an official State of
> California website. It is not affiliated with or endorsed by the State of
> California or any state or local agency. Analytical labels are not official
> implementation statuses or legal conclusions.

## Quickstart

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Before proposing a change:

```bash
npm run check
```

## What this is

- A structured reading of the signed executive order
- A traceable separation among source language, reviewed public evidence,
  context-only research leads, and analysis
- A public dataset with section locators, review dates, and stable identifiers
- A relationship index separating explicitly named bodies from inferred
  cross-directive links
- A way to surface delivery questions that the primary source does not answer

## What this is not

- An official implementation or accountability dashboard
- A determination of legal compliance or agency performance
- Evidence that work has or has not occurred outside the public record
- A comprehensive or live catalog of implementation activity
- A geographic map, transit-feed validator, or reporting automation system
- An official workflow, responsibility matrix, critical path, or interagency
  handoff record

## AI-assisted questions (optional, unofficial)

Under [ADR-0002](docs/adr/0002-runtime-grounded-question-answering.md) the
Atlas has an optional question-answering layer that a reader can turn on from a
directive page **where one is configured**. It is built and evaluated; it is
not deployed, and the panel is gated on that: a build with no question service
configured renders no panel at all, so the published site offers nothing it
cannot answer. It can only quote the signed
order verbatim (verified against the retained copy in
[`corpus/eo-n-7-26/`](corpus/eo-n-7-26/manifest.json)), cite a reviewed
evidence record by ID, repeat the site's own empty-state wording, or decline.
It refuses every form of "is the state complying" or "is this on track". Its
output is AI-generated, unofficial, and never a compliance determination. The
static site works with the service absent and makes no request beyond its own
origin until a reader opts in. The service, its cost controls, and its
not-applied deployment shape are documented in
[`docs/AI-SERVICE.md`](docs/AI-SERVICE.md); the evaluation harness and its
honesty rules are in [`evals/README.md`](evals/README.md).

The two suites that carry zero tolerance both pass on the committed prompt:
48 of 48 compliance, status, grading, and forecast phrasings refused, and 20 of
20 empty-state answers carrying the site's own absence wording with no status
language published. That is a measurement of one prompt version and one model
on one date, recorded in [`evals/results/`](evals/results/) — not a guarantee
about a later model.

## Primary sources

- [Executive Order N-7-26 — signed PDF](https://www.gov.ca.gov/wp-content/uploads/2026/06/ATTESTED_6.26-Transit-EO_FINAL_SIGNED.pdf)
- [Official announcement and summary](https://www.gov.ca.gov/2026/06/26/governor-newsom-signs-executive-order-to-accelerate-new-technologies-and-services-for-californias-local-transit-and-passenger-rail-networks-throughout-the-state/)

The signed order controls when summaries differ. Every analytical record is
stored separately from the source extraction and labeled as interpretation.

## Explore the data

The canonical data lives in `data/`. Build-time exports are published as JSON
and CSV under `public/data/`.

- `sources.json` records the official source, dates, retrieval date, and hash;
  the signed PDF itself, a machine OCR of it, the reviewed OCR corrections, and
  the resulting text are retained under `corpus/eo-n-7-26/` with their hashes
  so a quotation can be checked mechanically (the signed image controls)
- `organizations.json` provides stable identifiers for explicitly named bodies
- `directives.json` contains the 21 actionable directive units in document order.
  Where the order states timing, the Atlas publishes a calculated planning date
  and states its position relative to the build date; a date behind the build is
  flagged as passed, which is arithmetic on the order's language and not a
  finding that a directive is late or out of compliance (see
  [the methodology](docs/METHODOLOGY.md))
- `analysis.json` contains plain-language summaries, themes, inferred outputs,
  dependencies, and open questions
- `evidence.json` contains a selective collection of dated public artifacts,
  exact directive citations, locators, hashes, review dates, and limitations,
  plus the layer's review commitment: a planned next review date (gated like
  the watchlist's), the committed list of public sources checked with each
  source's last-checked date and outcome, and a dated sweep log. Each directive
  page states whether its listed sources were checked and found nothing or have
  not yet been successfully checked (see
  [evidence model](docs/EVIDENCE-MODEL.md))
- `watchlist.json` contains a separate selective collection of official context
  sources and publication checkpoints, editorial relevance links,
  evidence-boundary notes, and planned review dates. A planned review date that
  has passed is published as overdue against the build date and fails the
  release gate after a 14-day grace window (see
  [watchlist model](docs/WATCHLIST-MODEL.md))
- `tda-ntd-feasibility.json` contains the cited four-field reporting research,
  feasibility classes, controls, and remaining evidence needs

The first reporting slice compares passenger boardings, vehicle revenue miles,
vehicle revenue hours, and operating expense across the State Controller's
Transit Operator Financial Transactions Report and FTA's reduced-reporting
framework. It supports assisted preparation and reconciliation—not automated
certification or filing. The accompanying [expert review guide](docs/EXPERT_REVIEW_GUIDE.md)
provides a repeatable usability and domain-review script.

Readers can [suggest a source-backed correction or share structured review
feedback](https://transit.chelseakr.com/corrections/). Public submissions must
exclude confidential records, personal data, credentials, and security details.

The public JSON keeps those layers separate. `directives.csv` contains the
source/analysis crosswalk, while `evidence.csv` contains the public-artifact
records and their explicit directive relationships.
The context watchlist has an independent `watchlist.json`, `watchlist.csv`, and
JSON Schema contract; it does not contribute to evidence counts.
`directive-organizations.csv` normalizes the 50 source-role links, and
`directive-relationships.csv` normalizes the 27 inferred cross-references.
The latter preserves analytical-record provenance without asserting workflow
direction. Omission from the evidence collection does not show that no
activity or public record exists; inclusion does not establish completion,
compliance, or performance.

See [the methodology](docs/METHODOLOGY.md),
[relationship model](docs/RELATIONSHIP-MODEL.md),
[evidence model](docs/EVIDENCE-MODEL.md),
[watchlist model](docs/WATCHLIST-MODEL.md), and
[product specification](docs/PRD.md) for the classification model, acceptance
criteria, and known limitations.

## Corrections and contributions

Corrections should identify the directive, evidence, or watchlist ID; public
source; section, page locator, or evidence-boundary statement; and the proposed
change. Source, evidence, watchlist, and analytical changes are reviewed
separately and must never be mixed silently.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the review and validation workflow.

## Accessibility

The project targets WCAG 2.2 Level AA and is being evaluated against the
web-content requirements of the Revised Section 508 Standards. The Revised 508
Standards incorporate WCAG 2.0 Level A and AA; the WCAG 2.2 target adds newer
success criteria without replacing 508-specific scoping and functional review.

This independent site is not represented as a federal system or as legally
certified. California Government Code §7405 requires state governmental entities
developing, procuring, maintaining, or using information technology to comply
with Section 508 requirements, which makes 508 readiness relevant to the
project's intended context.

- [Section 508 web-content overview](https://www.section508.gov/test/websites/)
- [California Government Code §7405](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=7405)
- [Accessibility approach and current test scope](docs/ACCESSIBILITY.md)

The last manual accessibility review was on **2026-07-13, at commit `ef1d11b`**,
and covered the routes that existed then. Lint, canonical-data validation and
rendered-HTML assertions still run on every build; the representative-route
scans and spot checks from that review were a one-off and are not reproducible.

`/research/tda-ntd`, `/corrections` and `/watchlist`, the watchlist disclosure
pattern, the print control, the URL-syncing filters, and the 2026-07-22 register
redesign shipped after that review and are **not** covered by it. That is a
statement about evaluation coverage, not a finding about those surfaces. Full
cross-browser keyboard, screen-reader, zoom, forced-colors, and disabled-user
evaluation remains pending. These checks are quality controls, not an
accessibility certification or a conformance claim. See
[docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) for the dated scope.

## Standards Conformance

Transit Delivery Atlas is developed against a shared set of portfolio
engineering standards. That set has fifteen standards, and all fifteen are
listed below: silent omission of a standard is itself a defect, so a standard
that does not apply carries a reason and a standard that applies but is not met
says so.

The set is `ChelseaKR/portfolio-standards`, and this declaration is made
against **v2.0.0** (tagged 2026-08-09, commit `e9cddff`). Two things follow
from that pin rather than being fixed by it. The standards repository is
private and this one is public, so a public repository cannot fetch it: no
workflow here can resolve the pin, and this is the same access boundary that
broke the release authorization job until it was re-pointed at a public copy
(see `scripts/check-release-authorization.mjs`). The standards are also not
vendored in-tree. The table below is therefore a **declaration** of
applicability and current state against a named version — not a result
produced by a checker running against it, and not something CI can verify.
A row is only as current as its review date.

Rows reviewed 2026-08-15 against v2.0.0. The AI Evaluation row was
re-reviewed 2026-08-22 when the runtime service landed.

| Standard | Applies? | State |
|---|---|---|
| Responsible-Tech Framework | Applies | Independent-analysis posture, correction workflow, and explicit non-affiliation labeling (see "What this is not") |
| Code Quality | Applies | ESLint + strict TypeScript typecheck, fail-closed data validation; node:test suite under a coverage floor (90% lines, 78% branches, 90% functions over the `lib/`, `scripts/` and `service/` files the tests load; see the `test` target in the Makefile for what that denominator does and does not include); gated in CI (`npm run check`) |
| Security & Supply-Chain | Applies | CodeQL SAST, TruffleHog full-history secret scan, Dependabot, npm production audit, SHA-pinned actions, SECURITY.md |
| CI/CD | Applies | Quality gate on every push/PR; OIDC-based deploy that verifies the built artifact against the canonical data before uploading, then smoke-checks the live edge against those same bytes (`.github/workflows/`) |
| Observability | Applies | Static site: build SHA published at `/version.json`; deploy workflow smoke-verifies the exact released SHA and security headers |
| Performance | Applies | Not met. The release gate (`npm run check`) runs lint, typecheck, tests, and a production audit, and measures nothing about performance: there is no Lighthouse-CI run, no bundle budget, and no committed performance baseline to regress against |
| Accessibility | Applies | WCAG 2.2 AA target with Section 508 framing; rendered-HTML test assertions on every build; last manual review dated 2026-07-13 at `ef1d11b`, with the routes and patterns shipped since listed as uncovered (docs/ACCESSIBILITY.md) |
| Internationalization | Applies | English-only today; owner, first localization boundary, source-language rule, fallback, and review deadline are declared in [`docs/I18N.md`](docs/I18N.md) |
| AI Evaluation | Applies | The static site has no model component; the optional runtime question-answering service added under [ADR-0002](docs/adr/0002-runtime-grounded-question-answering.md) has five committed suites run live against the real pipeline on `global.anthropic.claude-sonnet-4-6` (Amazon Bedrock), prompt `2026-08-21.1`, 2026-08-22: compliance refusal 48/48 and empty-state fidelity 20/20 at zero tolerance, freshness 10/10, citation grounding 15/15, question structuring 20/22. Results are committed only from recorded live runs with provider, model, prompt version, commit, and date, enforced by `tests/eval-results.test.mjs`; a suite not run live is published as not run, never as a number |
| AI Development Measurement | Applies | Not met. This repository is built with AI assistance and publishes no measurement of it: no committed metrics ledger, no delivery-outcome record, and no quality-debt counterweight |
| Documentation | Applies | Partially met. README, methodology/evidence/relationship models, ADR log (docs/adr/), CHANGELOG, CONTRIBUTING. The standards set is now pinned for this declaration at v2.0.0 (see above). Still not met: the standards are not vendored in-tree, and being private they cannot be fetched by this public repository's CI, so the documentation controls that require an in-tree or fetchable copy remain unevaluated here rather than evaluated and passed |
| Quality & Metrics | Applies | Data-integrity, filter, rendered-HTML, and hosting test suites run in the release gate |
| Release & Versioning | Applies | CHANGELOG (Keep-a-Changelog), semver in package.json, tag-triggered release workflow re-runs the full gate at the tagged commit |
| Incident Response | Applies | Not met. `SECURITY.md` covers private vulnerability reporting only. There is no severity ladder, no incident label convention, no committed postmortem artifact, and no secret-leak runbook |
| Data Governance | Applies | Partially met. Every record in `data/sources.json` carries a publisher, canonical URL, retrieval date, and SHA-256; reuse terms are stated in [`CONTENT-LICENSE.md`](CONTENT-LICENSE.md); the published exports are validated against the published `data/public-schema.json` in the release gate. Not met: no committed data card, data classification, or retention statement |

## Licensing

- Code: [Apache-2.0](LICENSE)
- Original structured analysis and documentation: [CC BY 4.0](CONTENT-LICENSE.md)
- Government source documents and quoted material remain subject to their own
  terms and are not relicensed by this project

## Support

This is independent, unpaid work. If it has been useful to you, you can
<a href='https://ko-fi.com/T6T6GMYTU' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
