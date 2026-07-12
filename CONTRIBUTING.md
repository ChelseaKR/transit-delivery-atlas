# Contributing

Contributions are welcome when they preserve the atlas’s source-first model and
independent posture.

## Corrections

A source correction should include:

1. Directive ID
2. Official source URL
3. Exact section and page locator
4. Current text
5. Proposed replacement

Source corrections and analytical changes are reviewed as separate concepts,
even when proposed together. Do not silently move an inference into a source
record.

## Product changes

Before opening a pull request:

```bash
npm install
npm run check
```

Pull requests should explain what changed, why it changed, user impact, and the
checks performed. Generated JSON, CSV, and schema files must match their source
records.

## Content rules

- Cite primary government or standards sources for factual additions.
- Label interpretations and dependencies as inference.
- Preserve qualifiers and uncertainty.
- Do not claim implementation status without a separately designed evidence
  model and review policy.
- Do not introduce agency logos, seals, official wrappers, trackers, or
  personal acknowledgments.
- Describe accessibility tests accurately; never call automated checks a
  certification.
