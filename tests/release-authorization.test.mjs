import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  parseAuthorizeUses,
  parseWorkflowCallContract,
} from "../scripts/check-release-authorization.mjs";

// The checker walks indentation instead of parsing YAML, so the parsers are the
// part most able to fail open. These cases pin the behaviour that matters: the
// right reference is read out of the right job, and anything unrecognised throws
// rather than returning a shape the caller would treat as a pass.

const REAL_RELEASE_WORKFLOW = await readFile(
  new URL("../.github/workflows/release.yml", import.meta.url),
  "utf8",
);

test("reads the authorize reference out of the repository's own release workflow", () => {
  const authorize = parseAuthorizeUses(REAL_RELEASE_WORKFLOW);
  assert.equal(authorize.path, ".github/workflows/release-authorize.yml");
  assert.match(authorize.ref, /^[0-9a-f]{40}$/);
  assert.ok(authorize.owner.length > 0);
  assert.ok(authorize.repo.length > 0);
});

test("reads the reference from the authorize job, not from a neighbouring job", () => {
  const workflow = [
    "jobs:",
    "  preflight:",
    "    uses: someone/wrong/.github/workflows/other.yml@" + "0".repeat(40),
    "  authorize:",
    "    uses: owner/host/.github/workflows/release-authorize.yml@" + "a".repeat(40),
    "    with:",
    "      tag: ${{ inputs.tag }}",
    "  build:",
    "    runs-on: ubuntu-latest",
  ].join("\n");

  const authorize = parseAuthorizeUses(workflow);
  assert.equal(authorize.owner, "owner");
  assert.equal(authorize.repo, "host");
  assert.equal(authorize.ref, "a".repeat(40));
});

test("picks up an explicit allowed-signers-path override from the caller's with: block", () => {
  const workflow = [
    "jobs:",
    "  authorize:",
    "    uses: owner/host/.github/workflows/release-authorize.yml@" + "a".repeat(40),
    "    with:",
    "      tag: ${{ inputs.tag }}",
    '      allowed-signers-path: ".github/signers/release"',
  ].join("\n");

  assert.equal(
    parseAuthorizeUses(workflow).with.get("allowed-signers-path"),
    ".github/signers/release",
  );
});

test("throws rather than returning nothing when there is no authorize job", () => {
  const workflow = ["jobs:", "  build:", "    runs-on: ubuntu-latest"].join("\n");
  assert.throws(() => parseAuthorizeUses(workflow), /no "authorize" job/);
});

test("throws when the reference is not owner/repo/path@ref", () => {
  const workflow = ["jobs:", "  authorize:", "    uses: ./.github/workflows/local.yml"].join("\n");
  assert.throws(() => parseAuthorizeUses(workflow), /Cannot parse the authorize/);
});

test("reads the workflow_call inputs and outputs of a reusable workflow", () => {
  const reusable = [
    "on:",
    "  workflow_call:",
    "    inputs:",
    "      tag:",
    "        required: true",
    "        type: string",
    "      allowed-signers-path:",
    "        required: false",
    "        type: string",
    "    outputs:",
    "      release-commit:",
    "        value: x",
    "      release-tag:",
    "        value: y",
    "      tag-object-sha:",
    "        value: z",
    "",
    "jobs:",
    "  authorize:",
    "    runs-on: ubuntu-latest",
  ].join("\n");

  const contract = parseWorkflowCallContract(reusable);
  assert.deepEqual(contract.inputs, ["tag", "allowed-signers-path"]);
  assert.deepEqual(contract.outputs, ["release-commit", "release-tag", "tag-object-sha"]);
});

test("does not mistake a job name for a workflow_call output", () => {
  const reusable = [
    "on:",
    "  workflow_call:",
    "    outputs:",
    "      release-tag:",
    "        value: y",
    "jobs:",
    "  release-commit:",
    "    runs-on: ubuntu-latest",
  ].join("\n");

  const contract = parseWorkflowCallContract(reusable);
  assert.deepEqual(contract.outputs, ["release-tag"]);
});

test("throws when the called workflow is not callable at all", () => {
  const reusable = ["on:", "  push:", "    branches: [main]"].join("\n");
  assert.throws(() => parseWorkflowCallContract(reusable), /no `on.workflow_call` trigger/);
});
