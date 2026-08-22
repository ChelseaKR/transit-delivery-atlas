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

`watchlist.json` is a separate context-only research contract, not a fourth
canonical provenance layer. It stores official developments that are worth
rechecking but do not currently meet the explicit-citation evidence rule.
Watchlist relationships never contribute to evidence counts or substitute for
the citation, locator, hash, and limitations review required here.

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

## Review commitment, source list, and sweep log

Schema 0.3.0 gives the evidence collection the forward commitment the context
watchlist already had, so an empty evidence list can say which of two things it
means. The collection carries:

- `nextReviewOn` — the date by which the listed sources are checked again. It
  expires against the build date under exactly the watchlist rule: a lapsed
  date is published as lapsed, and the release gate fails once it is more than
  the shared grace window overdue (`lib/watchlist-review.mjs`).
- `reviewCommitment` — the standing commitment in prose, including the sweep
  planned for the week after the 2026-10-24 calculated planning date shared by
  directives 1(a) through 1(g).
- `reviewSources[]` — the committed list of public sources that are checked,
  each with the directives it covers, `lastCheckedOn`, and `lastCheckOutcome`
  (`checked` or `retrieval-failed`). A source that could not be retrieved is
  recorded as not reviewed, never as checked.
- `sweeps[]` — one entry per sweep, dated, listing the sources checked and the
  evidence IDs added. A sweep that adds nothing is still recorded, and the
  latest sweep's date is the collection's `lastUpdatedOn`.

From those fields `lib/evidence-coverage.mjs` derives one of three states for
each directive, and every surface that shows an empty evidence list uses it:

| State | Meaning |
|---|---|
| `linked` | At least one reviewed artifact is linked to the directive. |
| `checked-none-found` | No artifact is linked, and at least one listed source covering the directive was successfully checked on a stated date without finding an artifact that cites the order. |
| `not-yet-reviewed` | No artifact is linked, and no listed source covering the directive has been successfully checked. |

None of the three is an implementation status. "Checked, nothing found" is a
fact about the Atlas's own search, stated with its date and its source list so
a reader can repeat it; it says nothing about work outside those sources.

## Corrections

Evidence corrections must identify the evidence ID, public artifact URL,
directive link, artifact page locator, current value, and proposed replacement.
Source, analysis, evidence, and watchlist changes are reviewed as separate
concepts even when one pull request contains more than one collection.
