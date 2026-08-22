# The question-answering service

The optional runtime layer decided in
[ADR-0002](adr/0002-runtime-grounded-question-answering.md). The static site is
complete without it; when it is absent, the "Ask about this directive" control
reports that the service is not available and everything else on the page is
unchanged.

## What it does

`POST /api/ask` takes `{ "question": "...", "directiveId": "n-7-26-1a"? }` and
returns either a grounded answer or a canonical refusal. The pipeline
(`service/answer.ts`):

1. **Pre-classify, deterministically.** The verdict lexicon
   (`lib/verdict-language.mjs`) refuses every compliance/status/grading/forecast
   phrasing before any model call, and explicit references to directives that
   do not exist (7, 1(h), 3(k)) are refused the same way.
2. **Structure.** The model maps the question to intent, directive IDs, and
   fields against the committed directive index. Its output is re-checked:
   IDs must resolve, the lexicon has the last word on verdicts, and an
   unresolvable lookup is "too vague", never a guess.
3. **Assemble facts.** The service builds the facts document itself from
   `data/` and `corpus/` — reviewed excerpts (as quotation IDs), named bodies,
   timing with derivation, evidence records with review dates, and the coverage
   state from `lib/evidence-coverage.mjs`.
4. **Narrate.** The model writes segments and may reference a quotation or an
   evidence record only by ID; the service substitutes the reviewed text.
5. **Verify.** Every quotation is checked verbatim against the retained corpus;
   every evidence citation must resolve; verdict sentences are withheld;
   the empty-state statement and a freshness block are inserted by
   construction; withheld claims are counted and reported. If nothing
   substantive survives, the record is rendered deterministically instead.

Every response carries `labels` (AI-generated, unofficial, not a compliance
determination), `provenance` (provider, model, prompt version, commit, corpus
hash, timestamp), and the withheld count.

## Running it

```bash
npm run ask:serve                      # Anthropic API, claude-sonnet-5
ASK_PROVIDER=bedrock npm run ask:serve # Amazon Bedrock, global.anthropic.claude-sonnet-4-6
```

Configuration (environment only; the service never reads or writes a
credential itself — the SDKs resolve `ANTHROPIC_API_KEY` or the AWS chain):

| Variable | Default | Meaning |
|---|---|---|
| `ASK_PROVIDER` | `anthropic` | `anthropic` or `bedrock` |
| `ASK_MODEL` | `claude-sonnet-5` / `global.anthropic.claude-sonnet-4-6` | Model ID for the chosen provider |
| `ASK_PORT` | `8787` | Listen port |
| `ASK_ALLOWED_ORIGIN` | *(empty)* | Origin granted CORS; empty means same-origin deployment only |
| `ASK_RATE_PER_MINUTE` | `6` | Per-client token bucket |
| `ASK_CLIENT_DAILY_CAP` | `40` | Per-client daily request cap |
| `ASK_DAILY_CAP` | `300` | Hard global daily cap |
| `ASK_MAX_QUESTION_CHARS` | `600` | Question length limit |
| `ASK_MAX_OUTPUT_TOKENS` | `2000` | Narration token ceiling |
| `ASK_TRUST_PROXY` | off | Use `X-Forwarded-For` for the client key |
| `ASK_DEBUG` | off | Include raw, unverified narration in responses (evals only) |
| `BUILD_SHA` | `unknown` | Commit recorded in answer provenance |

Cost control: the stable prompt prefix (instructions + directive index) carries
a cache breakpoint; the live smoke on 2026-08-21 measured the full prefix
written once (1,815 tokens) and read from cache on the next request. Rate and
daily caps are in-memory; a restart resets them, which is acceptable for one
small instance and is a documented limit. A `429` names its reason and a
`Retry-After`; the page stays intact.

Privacy: the service logs counts, outcomes, and durations — never question
text (`tests/service-server.test.mjs` proves it). No request body is stored.
The model provider's own data handling applies while a request is processed;
a production deployment must record that subprocessor relationship.

## Deployment shape (NOT APPLIED — owner decision needed)

Nothing below is provisioned. It is the shape a deployment would take so the
decision is concrete:

- **Same-origin path, no CSP change.** The site's CSP is `connect-src 'self'`.
  Run the service behind the existing CloudFront distribution as a second
  origin with a behavior for `/api/ask*` (origin: a Lambda function URL or a
  small App Runner/Fargate service running `npm run ask:serve`). The page then
  calls `/api/ask` on its own origin; `ASK_ALLOWED_ORIGIN` stays empty and no
  CORS or CSP edit is needed.
- **Cache behavior:** `POST` allowed, caching disabled, no cookies forwarded,
  a short origin-response timeout (~30 s).
- **Environment:** `ASK_PROVIDER`/`ASK_MODEL`, the credential (an Anthropic
  API key in a secret manager, or an IAM role with `bedrock:InvokeModel` on
  the chosen inference profile), `BUILD_SHA`, and the caps sized to a monthly
  budget: at the measured ~1.5K cached-input + ~0.4K output tokens per
  answered question, the default 300-question daily cap bounds spend to a few
  dollars a day at 2026 Sonnet pricing on either provider.
- **Open owner decisions before any of this is applied:** host choice and
  budget; the subprocessor/privacy note for reader questions leaving the
  origin; whether the per-client key uses `X-Forwarded-For` (set
  `ASK_TRUST_PROXY=1` only behind CloudFront); and an operational owner for
  the daily-cap alarm.

## Evaluation

See [`evals/README.md`](../evals/README.md). Results are committed only from
live runs with full provenance; `tests/eval-results.test.mjs` enforces it.
