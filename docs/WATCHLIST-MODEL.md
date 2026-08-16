# Context watchlist model

## Purpose

The context watchlist preserves useful official research leads without lowering
the implementation-evidence standard. It answers a different question from the
evidence register:

> Which official public development is worth checking again, and why does it
> not currently qualify as N-7-26 implementation evidence?

The watchlist is selective and date-bounded. It does not establish causation,
implementation activity, progress, completion, compliance, performance, or the
absence of other public or unpublished work.

## Structural boundary

The Source → Evidence → Analysis provenance sequence remains canonical.
Watchlist records are published in a separate `data/watchlist.json` contract
and rendered as context-only research leads. They do not contribute to evidence
counts or appear in the public evidence collection.

Every item must:

- use an official HTTPS source;
- state what the source says and why the Atlas is watching it;
- carry `explicitOrderCitation: false`;
- explain why it is outside the evidence layer;
- link to directives only through a controlled editorial relevance type;
- identify what a later review will look for and when that review is planned;
- preserve limitations that prevent causal or implementation claims; and
- retain retrieval, boundary-check, and review dates.

The watchlist deliberately omits evidence-only provenance fields such as an
artifact hash, exact order excerpt, evidence locator, page count, and
accessibility metadata. A qualifying artifact receives those fields through a
new evidence record rather than inheriting watchlist treatment.

## Controlled relevance types

- `topic-alignment`: the official item concerns the same subject matter as a
  directive.
- `process-adjacency`: the item is part of a public process concerning a program
  or output named in a directive.
- `publication-watch`: the page or event is a reasonable place to expect a later
  artifact relevant to a directive.

These are editorial research classifications. They are not evidence
relationships, official assignments, workflow edges, causal statements, or
implementation findings.

## Evidence-boundary reasons

- `no-explicit-order-citation`: the reviewed item does not cite N-7-26 or the
  mapped directive.
- `expected-artifact-not-published`: the page or event may later publish useful
  material, but the expected artifact was not available at review time.

Each record includes a plain-language boundary note. An expected publication
must not be described as published, and a scheduled event must not be described
as having occurred without a later source.

## Dates

`sourceDate` is optional. It is stored only when the official source supplies a
scheduled, published, or updated date and records where that date came from. An
undated page remains undated; `retrievedOn` is never substituted as a publisher
date.

`lastReviewedOn` records the latest manual check. `nextReviewOn` is a research
checkpoint, not a statutory deadline, implementation due date, or claim that a
new artifact will appear.

### When a planned review lapses

`nextReviewOn` is compared to the build date, not only to `lastReviewedOn`. A
date that can only ever be "later than the last review" cannot expire, and the
site is a static export that can sit unchanged at the edge for months.

- **The page says so.** A card whose planned review date has passed is published
  as **Review overdue** with the date it is due since, how far overdue it is at
  that build, and a note that its watch-for statements are what the next review
  will check rather than findings. The watchlist page counts the lapsed items
  and dates that count to the build. A `scheduled-event` source date that has
  passed without a later review is labelled as such instead of rendering as a
  plain date.
- **The gate says so.** `scripts/validate-data.mjs` warns from `nextReviewOn`
  and fails the release once an item is more than
  `REVIEW_GRACE_DAYS` (14) days overdue. Fail-closed is deliberate: a lapsed
  watchlist blocks an unrelated deploy until the item is re-reviewed. Set
  `ATLAS_BUILD_DATE` to judge the data at a fixed date.

The only correct response to the gate is to re-review the official source and
update `lastReviewedOn`, `evidenceBoundary.checkedOn`, and `nextReviewOn`
together. Moving `nextReviewOn` on its own republishes the same review under a
newer date, which is the failure the check exists to prevent.

## Promotion to evidence

Topical relevance is never promoted by itself. When a later artifact explicitly
cites N-7-26 or a directive, reviewers perform the complete evidence workflow:

1. Verify the publisher-supplied title, URL, context, and artifact date.
2. Capture a current SHA-256 and media/accessibility metadata.
3. Record the exact order citation and page locator.
4. Write an editorial summary and explicit limitations.
5. Add the new artifact to `evidence.json`.
6. Remove or narrow the watchlist item and record the transition in the
   changelog.

The evidence artifact remains independently reviewable; its provenance does not
depend on the earlier watchlist record.

## Corrections

A watchlist correction should identify the item ID, official URL, current
relevance or evidence-boundary statement, related directive, review date, and
proposed source-backed replacement. Watchlist, evidence, source, and analytical
changes are reviewed separately even when one public development affects more
than one collection.
