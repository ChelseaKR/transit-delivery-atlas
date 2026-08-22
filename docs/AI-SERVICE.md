# The question-answering service

The optional runtime layer decided in
[ADR-0002](adr/0002-runtime-grounded-question-answering.md). The static site is
complete without it.

## The site-side gate

The panel is rendered only where a service is configured to answer. The site
build reads `NEXT_PUBLIC_ASK_ENDPOINT`; unset, empty, or whitespace-only means
no service, and the directive pages render no panel, no button, and no input.

This is deliberate and it is the reason the control is not simply left in place
to report its own absence. An affordance a reader can see is a promise, and a
reader who has been invited to ask a question has already been told something
untrue by the time an error string explains that nothing is listening. A site
whose entire argument is that absence is published as absence does not get to
make an exception for its own feature.

Both directions are pinned by `tests/ask-gate.test.mjs`: the ordinary build is
asserted to render no panel on any of the twenty-one directive pages, and a
second, isolated build with `NEXT_PUBLIC_ASK_ENDPOINT` set is asserted to
render it, labelled and inert until used. (`NEXT_EXPORT_DIR` in
`next.config.ts` exists only so that second build cannot overwrite the `out/`
artifact the rest of the suite reads.)

Known residue: the panel's client chunk is still emitted and referenced by the
directive pages even in an ungated build, because the page's import of the
component survives the statically false branch. Nothing renders it and nothing
can reach it, but roughly 16 KB of inert code is served. Tracked as an issue
rather than fixed with a bundler alias.

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

One further variable belongs to the **site build**, not the service:

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_ASK_ENDPOINT` | *(unset)* | The path the panel posts to. Unset means no service is configured and no panel is rendered at all. A deployment sets it to the same-origin path (`/api/ask`) |

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
- **Turning the panel on is part of deploying.** The site build must set
  `NEXT_PUBLIC_ASK_ENDPOINT=/api/ask` in the same change that provisions the
  service; until then the published site renders no panel. Deploying the
  service without rebuilding the site leaves the feature invisible, and
  rebuilding the site with the variable set before the service answers puts a
  broken promise back on the page. They go together.
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
