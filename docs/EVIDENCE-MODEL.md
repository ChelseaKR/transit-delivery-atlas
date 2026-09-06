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

## Link integrity

Each record's SHA-256 exists so a quotation can be checked against the
publisher's own file. `npm run evidence:verify` re-fetches every artifact URL and
context URL and compares what is served now with what was reviewed, writing
`data/evidence-verification.json`. `scripts/validate-data.mjs` requires that log
to cover every evidence record, with the URLs the records actually cite, so a
record cannot quietly stop being re-checked.

Four artifact outcomes, and three for a context URL:

| Outcome | Applies to | Meaning |
| --- | --- | --- |
| `intact` | artifact | The bytes served now hash to the hash recorded at review. |
| `changed` | artifact | The bytes hash to something else — the publisher edited or re-issued the file at the same address. |
| `moved` | artifact, context | The URL redirects to a different address. |
| `gone` | artifact, context | HTTP 4xx/5xx, or no response at all. |
| `reachable` | context | The page answered. |

A context URL is **never** `intact`. It is a publisher's index page, no hash is
stored for it, and nothing was compared; calling the absence of a comparison a
match would be the same defect the hash exists to prevent. For the same reason,
a run in which no URL answered at all is reported as a run that could not happen
(exit 2, no log written) rather than as four artifacts having disappeared: a
machine with no network is not a finding about a public body's website.

Nothing is edited automatically. A record whose artifact is `gone` keeps its
place in the register and its review date — absence is disclosed, not deleted —
and `--draft-limitations` prints the sentence such a record would carry for a
person to read and paste into `limitations`. The drafted text states what was
observed and on what date, makes no claim about why, and is held to the same
verdict-language screen as every published sentence.

Every page that renders an evidence card renders the date of the last re-check
with it, from the committed log — the evidence index and each directive page
citing that record — through the one `components/ArtifactIntegrityRow.tsx` they
share. A record the log does not cover renders no such line at all.

The shared component is the point. The check first shipped on the evidence index
alone, so a record whose artifact had `changed` was disclosed there and cited in
silence on the directive page rendering the same card: same record, same build,
two different answers to whether the citation still resolves. A surface that
cites an artifact now inherits the disclosure rather than reimplementing it.

## Corrections

Evidence corrections must identify the evidence ID, public artifact URL,
directive link, artifact page locator, current value, and proposed replacement.
Source, analysis, evidence, and watchlist changes are reviewed as separate
concepts even when one pull request contains more than one collection.
