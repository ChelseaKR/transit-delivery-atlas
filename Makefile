# Convenience entry points for the checks CI runs (see .github/workflows/quality.yml).
# `make verify` is the single local gate referenced by CONTRIBUTING.md.

.PHONY: install verify lint typecheck test audit exports-committed release-authorization

install:
	npm ci

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm test

audit:
	npm run audit:production

# The exact release gate CI runs: lint + typecheck + build/tests + production audit.
verify:
	npm run check

# CI additionally asserts the generated exports under public/data are committed.
exports-committed:
	npm run data:export
	git diff --exit-code -- public/data

# The release workflow's cross-repository authorization dependency. Not part of
# `verify` because it reaches the GitHub API; run weekly by
# .github/workflows/release-authorization.yml and before cutting a tag.
release-authorization:
	npm run test:release-authorization
	npm run check:release-authorization
