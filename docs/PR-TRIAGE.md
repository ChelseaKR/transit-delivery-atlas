# Pull request triage

Reviewed 2026-08-28 against `main` at `cdd928b`. Nine open pull requests, three
open issues. This document exists to make the queue decidable; it is a review
record, not a merge authorization, and nothing in it has been merged, closed,
or commented on.

Every "fails without the change" claim below is marked as either **verified**
(re-derived here against `main`) or **trusted** (taken from the PR body). The
summary of that split is at the end.

## The stack

There is no stack. All nine pull requests target `main` directly:

```
main (cdd928b)
├── #83  fix/screen-published-exports-for-status      tests/data-integrity.test.mjs
├── #82  fix/evidence-coverage-null-statement         lib/ + scripts/ + tests/
├── #81  fix/sitemap-covers-every-route               tests/hosting.test.mjs
├── #80  fix/eval-zero-tolerance-authority            tests/eval-results.test.mjs
├── #79  fix/verify-every-published-quotation         tests/corpus.test.mjs
├── #77  dependabot/npm_and_yarn/next-16.3.1          package.json + lock
├── #76  dependabot/npm_and_yarn/eslint-config-next   package.json + lock
├── #75  dependabot/npm_and_yarn/typescript-6.0.3     package.json + lock
└── #44  docs/kofi-site-link                          components/ + css + asset
```

**No pull request would be auto-closed by merging and deleting another's base
branch.** Every base is `main`, so the failure mode that has bitten this
portfolio before does not apply here.

Two real coupling groups exist even without a stack:

1. **#79, #80, #81, #82, #83 all append to `CHANGELOG.md`** under
   `[Unreleased]`. Their code changes touch five disjoint files, so the only
   collision is the `### Fixed` heading and its bullet list. Whichever lands
   first creates the heading; the rest need a one-line textual resolution. No
   semantic conflict.
2. **#75, #76, #77 all rewrite `package.json` and `package-lock.json`.** These
   genuinely conflict with each other. They must be merged one at a time, each
   rebased after the previous one lands. Dependabot will rebase on its own.

## Merge state, read carefully

Eight of nine are green. One is red, and the red is **not** the code.

| PR | `validate` | Reading |
|---|---|---|
| #83, #82, #81, #80, #79 | SUCCESS | Ran 2026-08-28 against `cdd928b`. Current. |
| #77 | SUCCESS | Re-run 2026-08-28. Current. |
| #76, #75 | SUCCESS | Ran 2026-08-23. `main`'s tip is 2026-08-22, so this green still describes the current base. |
| #44 | FAILURE | **Not starved and not the diff.** See below. |

No job in this queue shows the starvation signature. I checked #44's failing
job directly: **9 steps, 32 seconds, steps executed through to
`Run release checks`**, which is a job that started and did work. A starved job
carries 0 steps, 3 to 5 seconds, and a budget annotation. This one has neither.

#44's actual failure is the last line of `npm run check`:

```
npm audit --omit=dev --audit-level=moderate
nanoid  <3.3.18   Severity: high
1 high severity vulnerability
##[error]Process completed with exit code 1
```

The 47 tests before it all passed. `main`'s lockfile now resolves
`node_modules/nanoid` at **3.3.18**, which is outside the advisory range, so
this failure is stale-base drift against a lockfile fixed on `main` since. A
rebase turns #44 green. Verified by reading the version out of the committed
`package-lock.json`.

---

## #83 — fix(data): screen the whole published dataset for status-like keys

**Base:** `main` · **Files:** `CHANGELOG.md`, `tests/data-integrity.test.mjs`

**What it does.** The existing screen named "evidence data recursively forbids
implementation-status-like keys" passed `{ evidenceScope, evidence }` to
`statusLikeKeys`. This adds a second test that screens the whole published
`directives.json`, plus `watchlist.json` and `tda-ntd-feasibility.json`, and
asserts the document's key count so the scope cannot silently narrow again.

**Correctness: sound.** The central claim is **verified**. `public/data/directives.json`
has exactly ten top-level keys (`project`, `schemaVersion`, `dataReviewedThrough`,
`source`, `orderMetadata`, `organizations`, `themes`, `directives`,
`evidenceScope`, `evidence`), and the existing test at
`tests/data-integrity.test.mjs:299` reads two of them. `directives` — the
substance of the export — was genuinely out of scope. The new test is not
vacuous: `assert.ok(keys.length >= 10)` plus five named-key assertions run
before `statusLikeKeys`, so a narrowed or renamed document fails loudly rather
than screening nothing. This is the correct shape for the "hardcoded member
list" trap, and it avoids it.

**Residual gap, not blocking.** The title says "the whole published dataset";
the change covers the three published JSON documents. `public/data/`'s five
CSV exports and the two published schema files are still unscreened. A `status`
column reaching `directives.csv` would not be caught. Worth a follow-up issue,
not a reason to hold the PR — it strictly widens coverage from 2 keys to 10.

**Overlaps.** None in code. `CHANGELOG.md` only.

**Recommendation: `merge`.**

---

## #82 — fix(evidence): stop publishing "null" as a source check date

**Base:** `main` · **Closes:** #74 · **Files:** `CHANGELOG.md`,
`lib/evidence-coverage.mjs`, `scripts/validate-data.mjs`,
`tests/evidence-coverage.test.mjs`

**What it does.** Two halves. `coverageStatement`'s `"linked"` branch now says
no check date is available instead of interpolating `null`, and
`scripts/validate-data.mjs` gains the reverse of an existing invariant: an
evidence record may not link a directive that no review source lists in
`coversDirectiveIds`.

**Correctness: sound, and the defect is real.** I ran the issue's reproduction
against `main`'s module and got the published prose back **verbatim**:

```
state: linked | lastCheckedOn: null
PROSE -> 1 reviewed public artifact is linked to this directive. The 0 listed
public sources covering it were last checked on null. The next planned check
of the listed sources is 2026-09-18.
```

That is **verified**, not trusted. The PR's sharper claim — that the reachable
route is a directive whose only covering source is `retrieval-failed` — follows
directly from the code I read: `checkedSources` filters on
`lastCheckOutcome === "checked"`, while the data-integrity suite only requires
a source be *listed*, and `chsra-newsroom` is already `retrieval-failed` in
committed data. The route is real.

The split between the two halves is deliberate and, in my reading, right: the
validator refuses the data-modelling error (a directive with evidence that no
source lists), while the renderer absorbs the legitimate transient case (every
covering source failed retrieval), because failing the release on a retrieval
failure would block a deploy for something no re-review can clear. That matches
how the repository already declines to fail on a calculated planning date
arriving.

The new sentence uses the vocabulary AGENTS.md allows — "has been successfully
checked", "states no check date" — and introduces no status language. It
parallels the existing `not-yet-reviewed` branch's wording.

The three added tests are not vacuous: the sweep over all 21 directives asserts
`coverage.length === 21` before screening, and the invariant test asserts
`linked.size > 0` before iterating. All helpers they use (`collection`,
`coverageForDirectives`, `readJson`) already exist in the file.

**One thing to accept knowingly.** The new validator invariant is a hard
`throw`. If a future sweep turns up evidence for a directive not yet in any
source's `coversDirectiveIds`, the release gate stops until the source list is
updated. The PR argues that is always a modelling error. I think that is
defensible and consistent with the repository's fail-closed posture, but it is
a real new way to block a release and should be a conscious choice.

**Overlaps.** None in code. `CHANGELOG.md` only.

**Recommendation: `merge`.** It closes #74 correctly and on the issue's own
terms (the issue proposed both fixes; this does both).

---

## #81 — fix(seo): derive the sitemap check's routes instead of copying them

**Base:** `main` · **Files:** `CHANGELOG.md`, `tests/hosting.test.mjs`

**What it does.** Replaces the nine-element static-route literal in the sitemap
test with a derivation over `app/**/page.tsx`.

**Correctness: sound.** The diagnosis is **verified**. `app/sitemap.ts:12-22`
holds a nine-element list and `tests/hosting.test.mjs:47-57` held the same nine
with trailing slashes. Neither side came from `app/`, so the assertion compared
a constant against a copy of itself and could only fail on a half-finished
edit, never on the property its name asserts.

I checked the derivation against the real tree rather than trusting it.
`find app -name page.tsx` returns exactly ten files; one is
`app/directives/[id]/page.tsx`, which the `.includes("[")` filter removes,
leaving nine static routes that match `app/sitemap.ts` exactly. The
`staticPaths.length >= 9` floor means a derivation that returned nothing fails
instead of passing — the "glob that matches nothing" trap is handled.

I also checked the PR's claim that this is "the same derivation
`tests/accessibility-scope.test.mjs` already uses". It is: the `appRoutes()`
function is character-for-character the same recursion. **Verified.**

**Two latent fragilities worth recording.** Neither is introduced by this PR
and neither blocks it:

1. `appRoutes()` does not strip Next.js route groups (`(marketing)`), private
   folders (`_lib`), or parallel routes (`@slot`). None exist in `app/` today.
   If one is ever added, this test and the existing accessibility-scope test
   both produce a path that is not a real URL. The bug would be duplicated in
   two places now instead of one.
2. `appRoutes()` is now copied into a second test file rather than shared. A
   fix to one copy will not reach the other. A small `tests/helpers/` module
   would be the better shape.

**Overlaps.** None in code. `CHANGELOG.md` only.

**Recommendation: `merge`.** Open a follow-up to share `appRoutes()` and teach
it about route groups.

---

## #80 — fix(evals): let the case files, not the results, declare zero tolerance

**Base:** `main` · **Files:** `CHANGELOG.md`, `tests/eval-results.test.mjs`

**What it does.** Two bypasses closed. `zeroTolerance` is now read from the
committed case file rather than from the result file being audited, and the
audit's work set becomes the five committed case suites rather than the
contents of `evals/results/`.

**Correctness: sound. Both bypasses are real.** **Verified** by reading `main`:

- `tests/eval-results.test.mjs:56` is `if (result.zeroTolerance && ...)` — the
  audited file certifies its own tolerance. Drop the flag, record failures,
  pass.
- The loop is `for (const file of files)` where `files` comes from
  `resultsDir`, while the `assert.ok(suites.length >= 5)` above it counts
  `casesDir`. With `evals/results/` empty the assertion passes and the loop
  validates nothing. This is the "checksum check blind to entries never
  written" pattern, exactly.

I also checked the PR's supporting claim that no committed result currently
contradicts its case file, since that determines whether this is a pure
guardrail or a behavior change. **Verified** — all five agree today:

| Suite | case file | result file |
|---|---|---|
| `compliance-refusal` | `true` | `true` (48/48) |
| `empty-state` | `true` | `true` (20/20) |
| `freshness` | `true` | `true` (10/10) |
| `citation-grounding` | `false` | `false` (15/15) |
| `structuring` | `false` | `false` (20/22) |

So this adds the check that would have noticed, and changes no result data. The
new unit tests genuinely fail against `main`'s `validateResultFile`, because
`main` never consults `caseFile` for tolerance at all.

**Note this surfaces something.** Three case files declare `zeroTolerance: true`,
not two. See "Defect found on main" below — that is a `README.md` problem, not
a #80 problem, and #80 is what makes it visible.

**Overlaps.** None in code. `CHANGELOG.md` only. Note that #80 and the main-branch
README fix below both concern zero tolerance but touch different files.

**Recommendation: `merge`.**

---

## #79 — fix(corpus): verify every string published as the order's own words

**Base:** `main` · **Files:** `CHANGELOG.md`, `tests/corpus.test.mjs`

**What it does.** The corpus test verified 24 `excerpt` fields against the
retained order text. The directive page also publishes 35 `qualifiers[].text`
under the heading "Qualifiers preserved from the source" and 8
`timing[].sourceText` phrases. This adds a second test covering those 43.

**Correctness: sound, and this is the most consequential of the five.** I ran
the check myself against `main`'s `lib/corpus.mjs` and the committed data:

```
total unlocated quotations: 43     (35 qualifiers + 8 timing)
FAILING today: 0
fabricated phrase "where feasible and appropriate" verbatim? false
```

So the new check bites on a fabrication and passes on the real data.
**Verified.**

The trap I specifically went looking for was whether `quoteIsVerbatim` *skips*
short fragments rather than rejecting them — which would have made the check
vacuous for the nine two-word qualifiers and left the PR's proof technically
true but the guarantee hollow. It does not skip. `lib/corpus.mjs` rejects any
fragment under `minimumFragmentLength` (default 12 normalised characters) with
`verbatim: false`. The check is genuinely load-bearing across all 43.

**A brittleness the PR does not mention, and should.** The shortest committed
qualifier normalises to **13 characters** ("where allowed") against a **12**
character floor. The margin is one character. A future qualifier that is a
legitimate verbatim phrase from the order but shorter — "if any", "as needed" —
will fail this gate as "fragment shorter than 12 characters", which is a false
failure, not a caught fabrication. It fails closed, which is the safe
direction, and the message is clear enough to diagnose. But it will happen, and
whoever hits it needs to know the floor is the reason. Worth a sentence in the
helper's doc comment.

The scoping is otherwise careful: the set is derived from the data rather than
listed, `qualifierCount >= 35` and `timingCount >= 8` prevent a check that
verifies nothing, and the PR correctly declines to assert page locators for
these strings because the schema gives them none — inventing a locator would
have been the wrong fix.

**Overlaps.** None in code. `CHANGELOG.md` only.

**Recommendation: `merge`.** Of the five, this closes the gap that matters most
to the project's stated value: strings published under a heading promising they
came from the source were the ones that could not be checked mechanically.

---

## #77 — chore(deps): bump next from 16.3.0 to 16.3.2

**Base:** `main` · **Files:** `package.json`, `package-lock.json`

**What it does.** Patch bump of `next` within the existing `^16.3.0` range.

**Correctness.** Green on a run re-executed 2026-08-28 against the current
base. Patch-level, in-range, no peer conflicts (`eslint-config-next` peers on
`eslint` and `typescript`, not on `next`). **Trusted**, on the strength of a
current green gate that includes build, typecheck, all suites, and the
production audit.

**Overlaps.** Lockfile conflict with #76 and #75. Serialize.

**Recommendation: `merge`.** Take this one first of the three dependency PRs —
it is the runtime dependency and the lowest-risk bump.

---

## #76 — chore(deps-dev): bump eslint-config-next from 16.3.0 to 16.3.1

**Base:** `main` · **Files:** `package.json`, `package-lock.json`

**What it does.** Patch bump of a dev-only lint config, within the existing
`^16.2.12` range.

**Correctness.** Green, ran 2026-08-23 against `cdd928b`, which is still
`main`'s tip, so the result is current despite the date. Dev dependency, so it
cannot affect the published artifact. **Trusted.**

**Overlaps.** Lockfile conflict with #77 and #75. Serialize. It does not need
to move in lockstep with #77 — I checked, and `eslint-config-next` declares no
peer dependency on `next`.

**Recommendation: `merge after rebase`** (rebase only because #77 should land
first and will move the lockfile).

---

## #75 — chore(deps-dev): bump typescript from 5.9.3 to 6.0.3

**Base:** `main` · **Files:** `package.json`, `package-lock.json`

**What it does.** Moves the exactly-pinned `typescript` from `5.9.3` to
`6.0.3`. This is a **major version bump**, and the only PR in the queue whose
risk is not visible in its diff.

**Correctness: probably fine, but it deserves the most scrutiny of the three.**
The green gate is real and it covers the current base: the run is dated
2026-08-23 and `main` has not advanced since 2026-08-22. `npm run check`
includes `tsc --noEmit --incremental false`, so a TS 6 compile error in `app/`,
`lib/`, `service/`, or any `.ts`/`.tsx`/`.mts` file would have surfaced.

The interaction I checked is with the five open fix PRs, since a major
compiler bump merged alongside new code is where this kind of thing usually
goes wrong. `tsconfig.json`'s `include` is `**/*.ts`, `**/*.tsx`, `**/*.mts`
and does **not** include `**/*.mjs`. Four of the five fix PRs touch only
`.mjs` test files, so they are outside the typechecker's scope entirely. #82
touches `lib/evidence-coverage.mjs`, which is pulled in transitively via
`allowJs` from `app/directives/[id]/page.tsx`, but its change is a plain
string return. **The risk of a #75 interaction with the fix queue is low, and
I verified the mechanism rather than assuming it.**

What I did **not** verify: whether TS 6 changes any emitted-behavior or
type-inference default that the suite does not exercise. A green `tsc --noEmit`
is good evidence and not proof.

**Overlaps.** Lockfile conflict with #77 and #76. Serialize.

**Recommendation: `merge after rebase`, and merge it alone.** Land it last of
the three dependency PRs, on its own, with a real gate run afterwards rather
than batched with anything else. If a regression appears later, this is the
commit to suspect first.

---

## #44 — feat(site): add a ko-fi support link to the footer

**Base:** `main` · **Files:** `CHANGELOG.md`, `app/globals.css`,
`components/SiteFooter.tsx`, `public/kofi.png`

**What it does.** Adds a Ko-fi support link to the site footer using a
self-hosted button image, plus a small CSS rule to suppress the footer's link
underline on the image.

**Not stale, and not superseded.** I checked: `components/SiteFooter.tsx` on
`main` contains no Ko-fi link and `public/kofi.png` does not exist. The Ko-fi
link in `README.md` is a different surface. This PR is still live work.

**The diff itself is good.** Self-hosting the button image is the right call
and the inline comment gives the right reason: the site's CSP is
`img-src 'self' data:`, so Ko-fi's CDN copy would be blocked, and serving it
locally also keeps a third party from observing who reads the site. `rel="noreferrer noopener"`
is set. The CSS comment explains itself.

**But it is wrong in one specific way, and merging it as-is would publish that
wrongness.** Its `CHANGELOG.md` hunk lands at **line 161, inside the
already-released `## [0.5.0] - 2026-08-16` section**, not under
`[Unreleased]`. When the PR was opened on 2026-08-15 that section *was*
`[Unreleased]`; v0.5.0 shipped the next day (#65) and moved it. The context
lines still match, so **git will apply it cleanly and no gate will object** —
GitHub reports `mergeable: MERGEABLE`. The result would be a feature that has
never shipped documented as part of a released version, in a Keep-a-Changelog
file the README points at as a Release & Versioning control. This is the
"individually green, wrong once merged" pattern, and it is invisible in the
PR diff view.

**Its red CI is not its fault.** As documented above: `npm audit` against a
stale lockfile, `nanoid <3.3.18`, on a base from 2026-08-15. `main` now carries
`nanoid` 3.3.18. Rebasing resolves it.

**Overlaps.** `CHANGELOG.md` with the five fix PRs, though in a different
section.

**Recommendation: `merge after rebase`,** with one required edit during the
rebase: **move the changelog bullet from the `[0.5.0]` section to
`[Unreleased]` → `### Added`.** Do not merge it without that; the rebase alone
will not fix it, because the hunk applies cleanly where it is.

---

## What I verified versus what I trusted

**Verified — re-derived here against `main`, not taken from a PR body:**

- #82's `null` reproduction, run against `main`'s `lib/evidence-coverage.mjs`.
  Output matched the issue and the PR verbatim.
- #79's 43 published quotations: counted (35 + 8), all verbatim against the
  retained corpus today, and a fabricated phrase correctly rejected.
- #79's non-vacuousness: read `lib/corpus.mjs` and confirmed short fragments
  are **rejected**, not skipped, and measured the 13-vs-12 character margin.
- #83's scope claim: `public/data/directives.json` has exactly ten top-level
  keys; the existing screen reads two of them.
- #81's route derivation: ten `page.tsx` files, one dynamic, nine static,
  matching `app/sitemap.ts` exactly; and the `appRoutes()` copy is identical to
  the one in `tests/accessibility-scope.test.mjs`.
- #80's two bypasses: read `tests/eval-results.test.mjs:56` and the work-set
  loop on `main`. Both confirmed. Also confirmed all five case/result
  tolerance pairs agree today.
- #44's CI failure cause (npm audit / nanoid), its step count and duration
  proving the job was not starved, `nanoid` 3.3.18 on `main`, the absence of
  Ko-fi from `main`'s footer, and the changelog hunk landing inside `[0.5.0]`.
- The file-overlap map for all nine PRs, and that every base is `main`.

**Trusted — not independently re-run:**

- That each PR's full `npm run check` passes on its own branch. I read the
  reported CI conclusions and the job step lists; I did not run the suites
  locally. This machine is under heavy shared load and the gate runs a full
  Next.js build.
- The PR bodies' pre-change/post-change exit codes and test counts. I verified
  the *underlying defect* for all five independently, which is the claim that
  matters; I did not reproduce their exact harness output.
- #77 and #76 being behaviorally safe patch bumps, beyond confirming they are
  in-range and that their green runs describe the current base.
- #75's TypeScript 6 compatibility beyond a green `tsc --noEmit`. I verified
  the tsconfig scope mechanism, not the compiler's full behavioral surface.

## Safe order of operations

There is no stack, so the only real constraints are the lockfile group and the
changelog heading. Merge in three phases, squash-merging each per AGENTS.md.

**Phase 1 — the five fix PRs.** Code-disjoint, all green, all independently
verified. Order within the phase is free; this order puts the highest-value
check first and leaves the smallest changelog cleanups for last:

1. **#79** (corpus quotations) — creates the `### Fixed` heading.
2. **#82** (coverage `null`) — also closes issue #74.
3. **#80** (eval tolerance authority).
4. **#83** (published status keys).
5. **#81** (sitemap derivation).

Each of #82 through #81 needs a trivial `CHANGELOG.md` resolution after #79
lands: keep both bullets under the one `### Fixed` heading. No code conflicts.

**Phase 2 — dependencies, strictly one at a time.** Each rewrites the lockfile,
so each needs a rebase after the previous. Let the gate run to completion
between them.

6. **#77** (`next` patch).
7. **#76** (`eslint-config-next` patch, after rebase).
8. **#75** (`typescript` major, after rebase) — **alone**, last, and watched.

**Phase 3 — the footer.**

9. **#44**, after rebase, **and only after moving its changelog bullet into
   `[Unreleased]` → `### Added`.** The rebase clears its red CI; it does not
   clear the misplaced changelog entry.

Doing Phase 1 before Phase 2 means the dependency bumps are gated by the
stronger test suite the five PRs install, rather than the other way round.

## Issues, briefly

- **#74** is closed by **#82**, correctly and on the issue's own terms.
- **#70** (structuring 20/22) is addressed by no open PR. It is correctly
  recorded rather than fixed: fixing it requires a `PROMPT_VERSION` bump and a
  fresh live run of all five suites, which is real work and not a queue item.
- **#73** (the gated panel still ships its client chunk) is addressed by no
  open PR and is deliberately unfixed. No action.

## Defect found on main, addressed separately

Not covered by any open pull request. Described in the accompanying summary and
fixed in the working tree: `README.md` states that **two** suites carry zero
tolerance, while `evals/cases/compliance-refusal.json`,
`evals/cases/empty-state.json` and `evals/cases/freshness.json` all declare
`zeroTolerance: true`, and `evals/README.md` marks all three "Zero" in both of
its tables. The count in the root README is short by one.
