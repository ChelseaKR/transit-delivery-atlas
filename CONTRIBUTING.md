# Contributing

Contributions are welcome when they preserve the atlas’s source-first model and
independent posture.

## Corrections

Start with the public [correction and review
chooser](https://transit.chelseakr.com/corrections/). Use the structured content
correction form for a source-backed change, or the review-feedback form for an
observed navigation, clarity, accessibility, or research finding.

A source correction should include:

1. Directive ID
2. Official source URL
3. Exact section and page locator
4. Current text
5. Proposed replacement

Source corrections and analytical changes are reviewed as separate concepts,
even when proposed together. Do not silently move an inference into a source
record.

An evidence correction should include:

1. Evidence ID
2. Public artifact URL and publishing-context URL
3. Linked directive ID and the artifact's exact citation
4. Artifact page and section locator
5. Current value and proposed replacement
6. Retrieval or review date and a current SHA-256 when the artifact changed

Evidence is a selective, date-bounded layer. Adding a record requires an
explicit source relationship and limitations that prevent the record from
implying completion, compliance, performance, or comprehensive coverage.
Scheduled-event dates must remain labeled as scheduled unless a later reviewed
record supports different wording.

A relationship correction should identify whether it changes a signed-source
role or an analytical cross-reference. Source-role changes require the signed
section and page locator. Analytical changes require the dependency statement,
record directive ID, related directive ID, and rationale. A related ID must not
be described as workflow direction unless a future controlled edge model and
review policy support that claim.

## Product changes

Before opening a pull request:

```bash
npm install
npm run check
```

Pull requests should explain what changed, why it changed, user impact, and the
checks performed. Generated JSON, CSV, normalized relationship tables, and
schema files must match their source records.

## Content rules

- Cite primary government or standards sources for factual additions.
- Label interpretations and dependencies as inference.
- Preserve qualifiers and uncertainty.
- Keep source, evidence, and analysis in their separate canonical files.
- Keep explicit body roles and inferred directive cross-references visibly and
  structurally separate.
- Do not turn reviewed evidence into implementation status, progress, scoring,
  compliance, or performance claims.
- Do not introduce agency logos, seals, official wrappers, trackers, or
  personal acknowledgments.
- Describe accessibility tests accurately; never call automated checks a
  certification.
