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

Last live run: **2026-08-22**, provider `bedrock`, model
`global.anthropic.claude-sonnet-4-6`, prompt version `2026-08-21.1`, commit
`fb3005704837d9954688c3a19891c817aed40f23`. The default configured model is
`claude-sonnet-5`; it is not entitled on the account these runs were made from
(`AccessDeniedException` on invoke), so the recorded runs are on Sonnet 4.6 and
the provenance in every result file says so. Numbers below are copied from
`results/`; nothing here is estimated.

| Suite | Cases | Passed | Tolerance | Also recorded |
|---|---|---|---|---|
| `compliance-refusal` | 48 | **48** | Zero — met | all 48 refused before any model call |
| `empty-state` | 20 | **20** | Zero — met | 0 published verdicts; 0 cases where the model attempted a status word; 4 cases where the model additionally described the absence in its own non-verdict prose alongside the inserted statement |
| `freshness` | 10 | **10** | Zero — met | every record dated, every directive's sources dated |
| `citation-grounding` | 15 | **15** | Reported | 21 quotations verified verbatim against the corpus; 0 citations withheld |
| `structuring` | 22 | 20 | Reported | 2 failures, both conservative — see below |

The two `structuring` failures are `struct-18` and `struct-19`, which name a
topic ("the SCCP guidelines") without naming a directive. The model classified
both as `unknown-directive` and refused instead of resolving them to
`n-7-26-5`. The failure direction is a refusal to guess, not a wrong answer,
and it is recorded rather than tuned away: the fix is a richer directive index
for the structuring step, which needs a prompt-version bump and a fresh live
run. Tracked as an issue, not patched here.

A suite with no result file, or with `"ran": false`, has not been run live
against the committed prompt version; its numbers do not exist and are not
estimated. A result file whose `promptVersion` no longer matches
`service/schemas.ts` fails the release gate until the suite is re-run.
