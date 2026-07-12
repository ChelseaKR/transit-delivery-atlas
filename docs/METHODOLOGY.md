# Methodology

## Source hierarchy

Version 0.1 uses the signed Executive Order N-7-26 as the controlling source.
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

## Source and analysis layers

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

An inference is never promoted to the source layer because it appears likely.

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
4. Run schema, reference, timing, export, and rendered-output tests.
5. Record corrections in the changelog.

## Limitations

- The source PDF is a scanned document and is not tagged for accessibility.
- Short excerpts are independently transcribed and may contain errors despite
  manual review; the signed image remains authoritative.
- The atlas does not assess implementation progress or unpublished activity.
- Calculated dates are planning aids rather than legal interpretations.
- Analytical dependencies identify questions for investigation, not official
  assignments.

## Corrections

A correction should include a directive ID, official source URL, exact locator,
and proposed replacement. Source corrections and analytical changes should be
reviewed as separate concepts even when delivered in one pull request.
