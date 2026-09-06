import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The scheduled secret scan must stay capable of failing.
//
// Three properties of .github/workflows/secret-scan-scheduled.yml are pinned here,
// because each one silently un-arms the scan when it breaks and none of them shows
// up as a red build:
//
// 1. The result tiers include `unverified`. TruffleHog sorts a finding into
//    `verified` (it authenticated the credential against the live service),
//    `unknown` (verification errored) and `unverified` (it asked, and the service
//    said no). A credential that leaked and was later REVOKED — the normal end
//    state of a real leak, and the exact case a scheduled full-history sweep
//    exists to catch — answers "no", so it is `unverified`. A scan configured
//    `--results=verified` (or `--only-verified`, or `--results=verified,unknown`)
//    cannot fail on it. Measured 2026-09-06 on a throwaway clone of this
//    repository with a real-shaped AWS key planted in one commit and deleted in
//    the next: `--results=verified` exited 0 reporting nothing, the widened tier
//    exited 183.
//
// 2. The action ref and the `version:` input name the same release. The `version:`
//    input selects the scanning binary — the action runs
//    `ghcr.io/trufflesecurity/trufflehog:${VERSION}` — while the `uses:` SHA pins
//    only the wrapper. This workflow had no `version:` at all, so the scanner
//    floated to whatever ghcr.io published most recently. Dependabot rewrites
//    `uses:` and never a `with:` input, so the two drift apart on every bump.
//
// 3. `fetch-depth: 0` survives on the checkout. Without it actions/checkout fetches
//    a single commit and this full-history sweep becomes a one-commit scan that
//    still reports success.
//
// The pin comment is a YAML comment, invisible to a YAML parser, so this reads the
// workflow as text on purpose.

const WORKFLOW_URL = new URL(
  "../.github/workflows/secret-scan-scheduled.yml",
  import.meta.url,
);
const WORKFLOW = await readFile(WORKFLOW_URL, "utf8");

// The tier a revoked credential lands in. Its absence is the defect.
const REQUIRED_RESULT_TIER = "unverified";

const extraArgs = [...WORKFLOW.matchAll(/^\s*extra_args:\s*(.+?)\s*$/gm)].map(
  (match) => match[1],
);

test("the scan states its result tiers, and never uses --only-verified", () => {
  assert.ok(
    extraArgs.length > 0,
    "no `extra_args:` found; this guard can no longer see the tiers it is meant to pin",
  );
  for (const args of extraArgs) {
    assert.ok(
      !args.includes("--only-verified"),
      `--only-verified cannot fail on a revoked credential, which is the normal end ` +
        `state of a real leak and the case this scan exists for. Offending args: ${args}`,
    );
    assert.match(
      args,
      /--results=[\w,]+/,
      `expected an explicit --results= tier list, got: ${args}`,
    );
  }
});

test("the scan reports the unverified tier, where a revoked credential lands", () => {
  for (const args of extraArgs) {
    const results = args.match(/--results=([\w,]+)/);
    assert.ok(results, `expected an explicit --results= tier list, got: ${args}`);
    const tiers = results[1].split(",");
    assert.ok(
      tiers.includes(REQUIRED_RESULT_TIER),
      `--results=${tiers.join(",")} omits "${REQUIRED_RESULT_TIER}", so the scan cannot ` +
        `fail on a credential the provider has already revoked. Measured: verified and ` +
        `verified,unknown both exit 0 on a planted-then-deleted AWS key; adding ` +
        `unverified exits 183.`,
    );
  }
});

test("the action ref and the version: input name the same release", () => {
  const pinned = [
    ...WORKFLOW.matchAll(
      /trufflesecurity\/trufflehog@[0-9a-f]{40}\s*#\s*v(\d+(?:\.\d+)*)/g,
    ),
  ].map((match) => match[1]);
  const selected = [
    ...WORKFLOW.matchAll(/^\s*version:\s*"?(\d+(?:\.\d+)*)"?\s*$/gm),
  ].map((match) => match[1]);

  assert.ok(
    pinned.length > 0,
    "could not read the trufflehog action pin and its `# vX.Y.Z` comment",
  );
  assert.ok(
    selected.length > 0,
    'no `version:` input on the trufflehog step. Without it the action defaults to "latest" ' +
      "and the SHA pin above it pins nothing that actually scans.",
  );
  assert.equal(
    pinned.length,
    selected.length,
    `${pinned.length} pinned trufflehog ref(s) but ${selected.length} version: input(s); ` +
      "every trufflehog step needs its own pinned version",
  );
  for (const [index, refVersion] of pinned.entries()) {
    assert.equal(
      refVersion,
      selected[index],
      `the action is pinned to v${refVersion} but \`version: ${selected[index]}\` is what ` +
        `downloads the scanner, so the scan would run ${selected[index]} and the bump to ` +
        `v${refVersion} is a no-op. Set them to the same release.`,
    );
  }
});

test("the checkout keeps full history, and the scan walks the whole repository", () => {
  assert.ok(
    WORKFLOW.includes("actions/checkout@"),
    "the scan no longer checks the repository out",
  );
  assert.match(
    WORKFLOW,
    /^\s*fetch-depth:\s*0\s*(#.*)?$/m,
    "`fetch-depth: 0` is missing from the checkout. actions/checkout then fetches a single " +
      "commit and this full-history sweep silently becomes a one-commit scan that still " +
      "reports success.",
  );
  assert.match(
    WORKFLOW,
    /^\s*path:\s*\.\/\s*$/m,
    '`path: ./` is missing; with path, base and head all unset the action exits on its own ' +
      '"BASE and HEAD commits are the same" guard having scanned nothing.',
  );
});
