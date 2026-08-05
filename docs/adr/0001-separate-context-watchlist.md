# 1. Keep context leads in a separate watchlist contract

## Status

Accepted

## Context

Research after the first evidence release found official developments that were
clearly relevant to N-7-26 subjects but did not satisfy the evidence policy.
Examples included an upcoming Commission hearing, a future meeting-materials
page, a new federal funding opportunity, regional Caltrans planning work, and an
undated page promising a future project database.

Adding those items to `evidence.json` would weaken the explicit-citation rule and
invite causal or implementation inferences. Omitting them entirely would discard
useful, dated research leads and make repeat reviews less systematic. Presenting
them as a fourth peer beside Source, Evidence, and Analysis would also give
topical context the visual and structural weight of reviewed evidence.

## Decision

We will publish official context leads in an independent, versioned
`watchlist.json` contract and dedicated `/watchlist` page.

- The Source → Evidence → Analysis provenance sequence and `S E A` marker remain
  unchanged.
- Watchlist items appear on matching directive pages only as a separate
  context-only aside after the three canonical layers.
- Every item records why it is being watched, why it is outside the evidence
  layer, controlled editorial relevance links, limitations, and a planned next
  review.
- `explicitOrderCitation` is fixed to `false`.
- Watchlist items do not contribute to evidence counts and are not embedded in
  the directive/evidence public JSON contract.
- The watchlist has independent JSON, CSV, and JSON Schema downloads.
- If a later artifact qualifies, reviewers add a new full evidence record and
  remove or narrow the earlier lead; topical relevance is never promoted by
  itself.

## Consequences

- Relevant official developments can be retained without changing the meaning
  of implementation evidence.
- Readers and data consumers can distinguish editorial research leads from
  explicit artifact-to-order relationships.
- The main public dataset remains on schema version 0.2.0; the watchlist begins
  an independent contract at version 0.1.0.
- Reviewers must maintain next-review dates and avoid leaving stale publication
  checkpoints unexplained.
- Consumers who want both evidence and context must join the separate exports by
  directive ID, an intentional friction that preserves the boundary.
