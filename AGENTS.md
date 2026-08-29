# Working in this repository

Read this before changing anything. It applies to people and to coding agents.

## What this project is

An independent, source-linked crosswalk of California Executive Order N-7-26.
It is not an official State of California site, not a compliance dashboard,
and never issues a finding about whether a directive is met, on track, late,
or complete. Absence of evidence is published as absence and never as a
status. Every structural rule below exists to protect that.

## Layers that must never blur

| Layer | Lives in | May contain |
|---|---|---|
| Source | `data/directives.json`, `data/sources.json`, `corpus/` | Reviewed excerpts of the signed order, locators, named bodies, timing text and its arithmetic |
| Evidence | `data/evidence.json` | Dated public artifacts that explicitly cite the order, with hash, locator, review date, limitations, plus the committed source list and sweep log |
| Analysis | `data/analysis.json` | Labelled interpretation: summaries, inferred outputs, dependencies, open questions |
| Context | `data/watchlist.json` | Research leads that do not meet the evidence rule |

A change to one layer is reviewed on its own. Never let model prose, an
inference, or a watchlist lead become a source excerpt or an evidence record.

## Rules the gate enforces

- `npm run check` is the release gate: lint, typecheck, build, every test
  suite, production audit. Run it before proposing a change.
- `scripts/validate-data.mjs` fails closed. Status-like keys (`status`,
  `progress`, `compliance`, `ontrack`, …) are rejected anywhere in `data/`.
- Planned review dates expire against the build date. A watchlist item or the
  evidence collection more than 14 days past `nextReviewOn` blocks a release
  until it is genuinely re-reviewed. Moving the date without re-reviewing the
  source is the one thing this repository treats as dishonest.
- Generated exports under `public/data/` are committed; CI diffs them.
- The verdict lexicon in `lib/verdict-language.mjs` is screened against every
  exported page, not only against model output. A sentence that trips it must
  be reworded or registered in `PERMITTED_VERDICT_SENTENCES`
  (`lib/published-language.mjs`) with the reason it is not a finding. An
  exemption the site no longer publishes fails the gate too.
- A source that could not be retrieved during a sweep is recorded as
  `retrieval-failed`, never as checked.

## The runtime AI layer (ADR-0002)

`service/` is an optional question-answering service. If you touch it:

- The model structures questions and narrates facts the service assembled. It
  never decides what counts as evidence and never writes the empty-state
  sentence; `lib/evidence-coverage.mjs` does.
- Every quotation of the order is verified against `corpus/eo-n-7-26/` before
  display. Every evidence citation must resolve to an ID. Verdict language is
  withheld. Do not weaken the verifier to make an eval pass.
- Compliance, status, grading, and "will they make it" questions are refused
  in every phrasing. Zero tolerance in `evals/`.
- Credentials come from the environment only. Never write a key to a file.
- Eval results are committed only from a recorded live run with provider,
  model, prompt version, commit, and date. Otherwise the result is `not_run`.
  Never fabricate a number.

## Wording

- "Reviewed", "linked", "checked on", "not yet reviewed" are allowed.
- "Complied", "compliant", "on track", "behind", "late", "missed", "met",
  "nothing has happened", "no progress" are not, anywhere a reader can see
  them, including AI output.
- A calculated planning date that has passed is "passed", with the arithmetic
  shown. It is not "overdue".

## Git

- Stage explicit paths. Never `git add -A`.
- Squash-merge pull requests; the commit subject is the PR title plus `(#N)`.
- Commit messages describe the code change and nothing else.
