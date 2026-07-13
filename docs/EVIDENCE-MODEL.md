# Implementation evidence model

## Purpose

Version 0.2 adds a third structural layer for dated public artifacts connected
to Executive Order N-7-26. The layer answers a narrow question: **which public
artifact has been reviewed, and why is it connected to a directive?** It does
not answer whether a directive is complete, compliant, successful, late, or
being worked on outside the public record.

## Layer boundary

The three canonical layers remain separate:

1. `directives.json` stores reviewed language and relationships from the signed
   order.
2. `analysis.json` stores independent summaries, inferred outputs and
   dependencies, confidence labels, and open questions.
3. `evidence.json` stores reviewed public artifacts, provenance, explicit
   directive relationships, review dates, and limitations.

An artifact never changes a source record or promotes an inference into the
signed layer. A link to an artifact is also not an implementation-status field.

## Required evidence fields

Every record must include:

- a stable editorial ID, publisher-supplied title with explicit provenance,
  publisher, and controlled artifact type;
- a dated-on value plus explicit date kind and origin, and separate retrieval
  and review dates;
- an HTTPS artifact URL and context URL;
- a SHA-256 hash, media type, page count, and cautious accessibility metadata;
- an explicitly editorial plain-language summary;
- one or more directive links with a controlled relationship, exact excerpt, and
  page locator; and
- explicit limitations that prevent the record from becoming a completion or
  performance claim.

The first supported relationship is `explicit-citation`: the artifact itself
names the order or directive. Later relationship types require their own review
policy before entering the schema.

## Coverage semantics

An empty evidence list for a directive means only that this curated dataset has
not linked a reviewed artifact to that directive. It is not evidence that no
work, coordination, draft, or decision exists.

The evidence layer is curated and date-bounded. Its machine-readable collection
scope is `selective`, accompanied by a coverage note that travels with public
exports. It is not comprehensive, live, or automatically scraped. The
collection's `lastUpdatedOn` is the latest record review date; each record's
`lastReviewedOn` tells readers when its URL, relationship, and limitations were
last checked.

A future date may be stored as `scheduled-event` when the artifact itself shows
that date. The interface must continue to say “scheduled” unless a later
reviewed artifact supports an occurred, published, adopted, or effective claim.

## Corrections

Evidence corrections must identify the evidence ID, public artifact URL,
directive link, artifact page locator, current value, and proposed replacement.
Source, analysis, and evidence changes are reviewed as separate concepts even
when one pull request contains all three.
