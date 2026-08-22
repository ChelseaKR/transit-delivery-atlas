# 2. Add a runtime question-answering layer that can only quote, cite, or decline

## Status

Accepted (owner-directed change of direction, 2026-08-21)

## Context

Until this decision the Atlas had no model component of any kind. The README's
standards table recorded "no generative or model-driven component anywhere in
the build or site", and the site's whole argument is that every claim carries a
source locator, a date, and a hash, with absence published as absence.

The owner has directed that the site add substantial AI features at runtime:
a question-answering layer over the Executive Order and the reviewed evidence,
for the advocates, reporters, and agency staff who use the site. That is a
direction change, and it lands on the two places a language model does the
most damage to a project like this one:

- **Absence rendered as a value.** Twenty of twenty-one directives carry no
  reviewed evidence. A model asked about one of them will, left to itself, say
  "the agency has not acted", "nothing has happened", or "this is on track".
  All three are findings the Atlas refuses to make, and the second and third
  are exactly the inference the coverage note exists to prevent.
- **Compliance verdicts.** The site is independent analysis. It never says
  whether a body is complying, on track, late, or finished. A model will be
  asked that in every phrasing there is, and any answer other than a refusal
  turns the site into the accountability dashboard it says it is not.

The existing discipline in `docs/METHODOLOGY.md` and `docs/EVIDENCE-MODEL.md`
already forbids status fields in the data and verdict language on the pages.
This decision extends the same rules to model output, and enforces them in
code rather than in prompt wording.

## Decision

Add a question-answering layer in a separate, optional service under
`service/`, written in TypeScript against the public Anthropic SDK, that the
static site calls only after a reader opts in on a directive page. The static
export is unchanged with the service absent.

The model is kept at the edges. It does two bounded jobs and nothing else:

1. **Structure the question.** The model turns a free-text question into a
   typed lookup: which directive IDs, which fields (source language, named
   bodies, timing, evidence), and which intent class. Intent classes include
   `compliance-verdict`, `out-of-scope`, `unknown-directive`, and `too-vague`,
   and the service handles those four deterministically with a refusal or a
   redirect; the model's structuring never reaches the narrator for them.
2. **Narrate a grounded answer.** For an in-scope lookup the service assembles
   the facts itself from `data/` and `corpus/` — the directive's reviewed
   excerpt, its explicitly named bodies, its timing with derivation, its
   evidence records with `lastReviewedOn`, and the coverage state from
   `lib/evidence-coverage.mjs` — and asks the model to narrate them. The model
   may refer to a quotation or an evidence record only by ID; the service
   substitutes the text. Free prose the model adds is checked before display.

**The verifier sits between the model and the reader.** Before anything is
shown:

- every quotation attributed to the order is checked verbatim against the
  retained corpus text (`lib/corpus.mjs`); a quotation that does not verify is
  withheld;
- every evidence citation must resolve to a record ID in `data/evidence.json`;
- the prose is scanned for verdict language (complied, on track, behind,
  late, met, failed to, nothing has happened, and their variants); a sentence
  that carries one is withheld;
- for a directive in the `checked-none-found` or `not-yet-reviewed` coverage
  state, the empty-state sentence is the one the site already publishes,
  inserted by the service, never written by the model;
- every answer that touches evidence states the record's `lastReviewedOn`, the
  covering sources' last-checked date, and the next planned sweep;
- withheld claims are counted and the count is shown.

**The retained corpus is the only source of quotations.** `corpus/eo-n-7-26/`
holds the official signed PDF (hash-matched to `data/sources.json`), a raw
machine OCR of it, a reviewed corrections log, and the corrected text the
verifier reads. The signed image controls; the text exists so the check can
be mechanical.

Consequential choices:

- **Provider and model.** The public `@anthropic-ai/sdk` with `claude-sonnet-5`
  as the configurable default. Amazon Bedrock is supported through the same
  SDK family for deployments that have it. Credentials come only from the
  environment; the service never writes a key to any file.
- **Cost and abuse controls from the first commit.** Per-client rate limit,
  a hard daily request cap, a per-request token ceiling, and prompt caching of
  the stable prefix. A limited request returns `429` with a plain-language
  body; the page stays intact.
- **No reader data is retained.** The service logs counts and verifier
  outcomes, not question text.
- **Evaluation is committed and honest.** Five suites live in `evals/`:
  empty-state fidelity, compliance refusal (zero tolerance), citation
  grounding, freshness disclosure, and question structuring including
  refused-to-guess. A result file is accepted only with provider, model,
  prompt version, commit, and date; a suite that was not run live is recorded
  as `not_run`, never as a number.
- **Deployment is not decided here.** A not-applied deployment shape is
  documented; provisioning it is an owner decision.

## Consequences

- The README's standards table row for AI Evaluation changes from N/A to
  Applies, and every place that said the site has no model component now says
  "none in the static site; an optional runtime service under ADR-0002".
- AI output is always labelled AI-generated and unofficial, is never a
  compliance determination, and sits under the same "not an official State of
  California website" notice as everything else.
- The verifier and the refusal rules are the review that exists for runtime
  output; their limits are stated beside the output. A passing evaluation is
  evidence about the committed prompt and model on the committed date, not a
  guarantee about a later model.
- The grounded-lookup design means the layer can answer only what the data
  already says. That is the point: a question the crosswalk cannot answer gets
  "the Atlas does not record that" and a pointer to what it does record.

## Alternatives considered

- **Free-form retrieval-augmented chat over the site's pages.** Rejected. It
  makes the grounding check open-ended and puts the model in charge of what
  counts as evidence.
- **Let the model produce the empty-state wording.** Rejected. The empty state
  is the highest-stakes sentence on the site and already has one canonical
  form; the service inserts it.
- **Build-time generated summaries instead of runtime answers.** Rejected by
  the owner as not meeting the product goal; the reviewed `analysis.json`
  summaries remain and are a separate, labelled layer.
- **A Python service.** Considered; rejected because the repository is
  Node-native and the existing gate (`npm run check`) can cover a TypeScript
  service without a second toolchain in CI.
