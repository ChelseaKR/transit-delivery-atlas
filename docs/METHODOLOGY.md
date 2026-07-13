# Methodology

## Source hierarchy

Version 0.2 uses the signed Executive Order N-7-26 as the controlling source.
The Governor’s announcement provides context but does not override the signed
text.

## Directive units

The atlas treats each labeled subsection as one actionable unit: `1(a)` through
`1(g)`, Section `2`, `3(a)` through `3(j)`, Sections `4` and `5`, and Section
`6`. This produces 21 units in signed-document order. Sections 5 and 6 contain
compound outputs but remain one unit each because the signed order does not
label separate subsections.

The Section 3 preamble is stored once as order-level source context and linked
to `3(a)` through `3(j)`. The filing clause and the order's non-enforceability
clause are preserved as order metadata rather than promoted to numbered units.

## Source, evidence, and analysis layers

Source records contain only:

- document and section identifiers
- editorial record titles with explicit title provenance
- page locators and short excerpts
- organizations explicitly named in the text
- exact qualifier text plus the clause to which it applies
- inherited source-context identifiers and transcription notes
- timing language and transparent date calculations

Analysis records contain:

- plain-language summaries
- controlled themes
- inferred outputs and dependencies
- open implementation questions

Evidence records contain:

- a publisher-supplied title, publisher, artifact type, and stable editorial ID
- an HTTPS artifact URL and publishing-context URL
- the date displayed by the artifact plus a controlled date kind and origin
- retrieval and review dates, media metadata, and a SHA-256 hash
- explicit directive relationships with exact excerpts and page locators
- an editorial summary, accessibility note, and record-specific limitations

Evidence is selective and date-bounded, not comprehensive or live. An artifact
is linked only when it explicitly cites the order or directive. Inclusion
documents that source relationship; it does not establish implementation
status, completion, compliance, or performance. Omission does not establish
that no implementation activity or public record exists.

An inference is never promoted to the source or evidence layer because it
appears likely. An artifact never changes the signed source record.

## Timing calculations

The order became effective June 26, 2026. Section 1 begins with “Within 120 days
of this Order,” which applies to `1(a)` through `1(g)`. Counting 120 calendar
days after the effective date produces October 24, 2026. The interface labels
that result as a calculated planning date, not a legal conclusion.

Section `1(e)` also says the referenced materials must be completed and included
in department documentation “within one year.” The atlas displays June 26, 2027
as an anniversary calculation and preserves the original phrase.

Sections 2 through 6 do not receive inferred deadlines. “Real time” describes
dashboard behavior, not delivery timing.

## Review process

1. Extract a directive from the signed source.
2. Verify section, page, excerpt, organizations, qualifiers, and timing against
   the source image.
3. Review the corresponding analytical record separately.
4. For an evidence record, verify the public URL, publisher, artifact date and
   date kind, hash, exact citation, locator, linked directive, and limitations.
5. If an artifact shows a future event, label the date as scheduled; do not
   imply that the event occurred or that a proposal was adopted.
6. Run schema, reference, timing, evidence, export, and rendered-output tests.
7. Record source, evidence, and analytical corrections separately in the changelog.

## Limitations

- The source PDF is a scanned document and is not tagged for accessibility.
- Short excerpts are independently transcribed and may contain errors despite
  manual review; the signed image remains authoritative.
- The atlas does not assess implementation progress or unpublished activity.
- The evidence layer is selective; it is not a claim about all available public
  records or activity beyond the reviewed artifacts.
- Calculated dates are planning aids rather than legal interpretations.
- Analytical dependencies identify questions for investigation, not official
  assignments.

## Corrections

A correction should include a directive or evidence ID, public source URL,
exact locator, current value, and proposed replacement. Evidence corrections
also include the artifact's directive link and current review/hash information.
Source, evidence, and analytical changes should be reviewed as separate
concepts even when delivered in one pull request.
