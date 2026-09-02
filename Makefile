# Convenience entry points for the checks CI runs (see .github/workflows/quality.yml).
# `make verify` is the single local gate referenced by CONTRIBUTING.md.

.PHONY: install verify lint typecheck test audit exports-committed release-authorization

install:
	npm ci

lint:
	npm run lint

typecheck:
	npm run typecheck

# `npm test` builds, runs the node:test suite, and holds it to a coverage floor.
#
# Until 2026-08-29 this repository had 148 tests across 19 files and measured no
# coverage at all, so nothing could say which first-party code those tests never
# reached. The floor is enforced by node's own `--experimental-test-coverage`, so
# it costs no new dependency: the flags live in the `test` script in package.json.
#
# Measured on node 22.19.0, the version every workflow pins, on 2026-08-29:
# 94.10% lines, 83.29% branches, 95.38% functions. The floors are 90, 78 and 90.
# The numbers move slightly between node majors (branch coverage reads 83.18 on
# node 26), which is part of what the slack is for.
#
# READ THIS BEFORE TRUSTING THE NUMBER. A coverage floor is only a floor over the
# set it measures, and this one does not measure everything it should:
#
#   1. `app/` and `components/` are outside it by choice. They are React server
#      components `node --test` cannot import without a renderer, so including
#      them would report every one at 0% and force a floor that gated nothing.
#      They are not untested: tests/rendered-html.test.mjs and
#      tests/accessibility-scope.test.mjs assert against the built HTML they
#      produce. That is coverage of the output, not of the source.
#
#   2. Inside `lib/`, `scripts/` and `service/`, node 22 reports only the files a
#      test actually imports. Seven first-party files are therefore invisible to
#      this gate rather than counted as zero: lib/build-date.ts, lib/data.ts,
#      lib/feedback.ts, lib/relationships.ts, scripts/export-data.mjs,
#      scripts/check-release-authorization.mjs and scripts/write-version.mjs.
#      94.10% is 94.10% of what the tests load, not of the tree.
#
# Closing (2) needs `--test-coverage-include-all`, which node 22 does not have.
# On node 26 the same suite measures 74.99% lines with those seven files counted,
# and that is the truer figure. Getting it would mean moving `engines` and all
# five workflows to node >= 24, which changes the runtime the site is built and
# deployed with, so it is deliberately not bundled into a coverage-floor change.
test:
	npm test

audit:
	npm run audit:production

# The exact release gate CI runs: the committed-export check, then lint, typecheck,
# build/tests and the production audit.
#
# The export check runs FIRST, and the order is the whole point. `npm test` calls
# `npm run build`, which calls `npm run data:export`, which writes ten tracked files
# under public/data. Until 2026-08-29 that was the only thing in the gate that
# touched them: every local `make verify` regenerated the committed exports into the
# working tree and reported success, so a stale export could not fail here. The
# thing that would have noticed had already repaired it. Checking before the build
# is what makes the answer about the committed bytes rather than about the bytes
# this run just wrote.
verify:
	npm run check

# Kept as a named entry point for regenerating and reviewing the diff by hand.
# `npm run check` now carries the check itself, on every path that runs it, which
# includes deploy.yml and release.yml -- neither of which ran an export check
# before. Prefer `npm run data:export:check`, which writes nothing and also
# catches an export that was never committed at all; `git diff --exit-code` cannot
# see an untracked file.
exports-committed:
	npm run data:export
	git diff --exit-code -- public/data

# The release workflow's cross-repository authorization dependency. Not part of
# `verify` because it reaches the GitHub API; run weekly by
# .github/workflows/release-authorization.yml and before cutting a tag.
release-authorization:
	npm run test:release-authorization
	npm run check:release-authorization
