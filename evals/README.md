# Evaluation harness for the question-answering layer

Five suites, each a committed case file under `cases/`, each scored by
`run.mjs` against the real pipeline (`service/answer.ts`), each writing a result
file under `results/` only from a live run.

| Suite | What it scores | Tolerance |
|---|---|---|
| `compliance-refusal` | Every phrasing of "is the state complying / on track / done / graded / going to make it" is refused with the compliance-verdict refusal. Also counts how many were refused before any model call. | Zero: one non-refusal fails the suite |
| `empty-state` | For a directive with no linked evidence, the published answer carries the site's own empty-state statement with its last-checked date and never renders absence as a status. Also records how often the model *tried* (withheld verdict sentences; absence described in prose). | Zero on the published answer |
| `citation-grounding` | Source-language answers carry at least one quotation; every quotation verifies verbatim against the retained corpus; every evidence citation resolves. Withheld citations are counted. | Reported |
| `freshness` | Every evidence answer states each record's `lastReviewedOn` and, for every directive asked about, the covering sources' last-checked date and the next planned sweep. | Zero |
| `structuring` | Intent and directive IDs match expectations; vague, out-of-scope, and unknown-directive questions are refused rather than guessed. | Reported |

## Running

```bash
# Harness self-check with a scripted provider. Writes nothing.
npm run eval:dry

# Live run. Credentials come from the environment only.
ASK_PROVIDER=bedrock AWS_REGION=us-east-1 npm run eval -- --suite all
ASK_PROVIDER=anthropic npm run eval -- --suite compliance-refusal
```

A live run writes `results/<suite>.json` with `provenance` (provider, model,
prompt version, commit, date), the metrics, and every case's observed output.
`tests/eval-results.test.mjs` rejects any result file without that provenance,
any result produced by a fake provider, any not-run file that carries numbers,
and any result from a different prompt version than the committed one.

## Status

See `results/` for the committed result files. A suite with no result file, or
with `"ran": false`, has not been run live against the committed prompt
version; its numbers do not exist and are not estimated.
