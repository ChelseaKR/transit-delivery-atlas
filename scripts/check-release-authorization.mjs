// Fail loudly when the release trust boundary stops being callable.
//
// `.github/workflows/release.yml` delegates its authorization job to a reusable
// workflow that lives in another repository. Nothing in this repository's normal
// CI touches that dependency: `quality.yml` never resolves it, CodeQL's `actions`
// pack does not fetch it, and `release.yml` itself only runs on
// `workflow_dispatch`. The first time anyone finds out the reference is broken is
// the moment they try to cut a release.
//
// That is not hypothetical here. Until 2026-08-08 this workflow pointed at
// `ChelseaKR/portfolio-standards`, which is private. Actions and reusable
// workflows in a private repository can only be used by other *private*
// repositories owned by the same account; the "Accessible from repositories owned
// by <user>" access policy does not extend to public callers. This repository is
// public, so every dispatch was rejected with HTTP 422 "workflow was not found"
// and no run record was ever created. It was fixed by re-pointing at a copy in the
// public `ChelseaKR/.github` repository (PR #49).
//
// The reference can break again in ways that leave no trace until release day:
//
//   1. the host repository is flipped to private, restoring the 422;
//   2. the pinned commit stops resolving (branch deleted, history rewritten);
//   3. the pin is moved to a revision whose `workflow_call` contract no longer
//      declares the outputs `release.yml` consumes, so the build job silently
//      checks out an empty ref;
//   4. the pin is loosened from a commit SHA to a mutable tag or branch;
//   5. the caller-side allowed-signers file the reusable workflow requires is
//      moved or deleted, so tag verification fails after the release is already
//      in flight.
//
// This script asserts all five on a schedule and on any change to the release
// workflow, so the failure surfaces on an ordinary Monday instead of mid-release.
//
// Usage: node scripts/check-release-authorization.mjs
// Reads GITHUB_TOKEN (or GH_TOKEN) when present; the API calls target public
// repositories, so an unauthenticated local run also works within rate limits.

import { realpathSync } from "node:fs";
import { readFile, access } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

const RELEASE_WORKFLOW = ".github/workflows/release.yml";
const API = "https://api.github.com";

// The three outputs `release.yml` reads back off the authorize job. Keep this in
// step with the `needs.authorize.outputs.*` references in that file.
const REQUIRED_OUTPUTS = ["release-commit", "release-tag", "tag-object-sha"];
const REQUIRED_INPUTS = ["tag"];

class CheckFailure extends Error {}

function fail(message) {
  throw new CheckFailure(message);
}

/**
 * Pull the `uses:` reference out of the `authorize` job of a caller workflow.
 *
 * Deliberately narrow and fail-closed: this walks the indentation rather than
 * parsing YAML (the repository has no YAML parser in its dependency tree, and
 * adding one to a supply-chain check is its own problem). Anything it cannot
 * recognise is an error, never a pass.
 */
export function parseAuthorizeUses(workflowYaml) {
  const lines = workflowYaml.split("\n");
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsIndex === -1) fail(`${RELEASE_WORKFLOW} has no top-level "jobs:" block`);

  let jobIndent = null;
  let inAuthorize = false;
  let uses = null;
  const withEntries = new Map();
  let withIndent = null;

  for (const line of lines.slice(jobsIndex + 1)) {
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    const indent = line.length - line.trimStart().length;
    if (indent === 0) break; // left the jobs block entirely

    const jobMatch = /^(\s+)([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobMatch && (jobIndent === null || jobMatch[1].length === jobIndent)) {
      jobIndent = jobMatch[1].length;
      inAuthorize = jobMatch[2] === "authorize";
      withIndent = null;
      continue;
    }
    if (!inAuthorize) continue;

    const usesMatch = /^\s+uses:\s*(\S+)\s*$/.exec(line);
    if (usesMatch && uses === null) {
      uses = usesMatch[1];
      continue;
    }
    if (/^\s+with:\s*$/.test(line)) {
      withIndent = indent;
      continue;
    }
    if (withIndent !== null) {
      if (indent <= withIndent) {
        withIndent = null;
      } else {
        const kv = /^\s+([A-Za-z0-9_-]+):\s*(.*?)\s*$/.exec(line);
        if (kv) withEntries.set(kv[1], kv[2].replace(/^["']|["']$/g, ""));
      }
    }
  }

  if (!uses) fail(`${RELEASE_WORKFLOW} has no "authorize" job with a "uses:" reference`);

  const ref = /^([^/]+)\/([^/]+)\/(.+)@(.+)$/.exec(uses);
  if (!ref) fail(`Cannot parse the authorize "uses:" reference: ${uses}`);

  return { owner: ref[1], repo: ref[2], path: ref[3], ref: ref[4], with: withEntries };
}

/**
 * Read the `workflow_call` contract out of a reusable workflow.
 *
 * Same fail-closed posture: a missing `workflow_call:` block is an error, and
 * only keys nested directly under `inputs:` / `outputs:` are collected.
 */
export function parseWorkflowCallContract(workflowYaml) {
  const lines = workflowYaml.split("\n");
  const callIndex = lines.findIndex((line) => /^\s*workflow_call:\s*$/.test(line));
  if (callIndex === -1) fail("The reusable workflow declares no `on.workflow_call` trigger");

  const callIndent = lines[callIndex].length - lines[callIndex].trimStart().length;
  const inputs = [];
  const outputs = [];
  let section = null;
  let sectionIndent = null;

  for (const line of lines.slice(callIndex + 1)) {
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= callIndent) break;

    const sectionMatch = /^\s*(inputs|outputs):\s*$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      sectionIndent = indent;
      continue;
    }
    if (section === null) continue;
    if (indent <= sectionIndent) {
      section = null;
      sectionIndent = null;
      continue;
    }

    const key = /^\s*([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (key && indent === sectionIndent + 2) {
      (section === "inputs" ? inputs : outputs).push(key[1]);
    }
  }

  return { inputs, outputs };
}

async function api(path) {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "transit-delivery-atlas-release-authorization-check",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, { headers });
  return { ok: response.ok, status: response.status, body: response.ok ? await response.json() : null };
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const callerSlug = process.env.GITHUB_REPOSITORY || "ChelseaKR/transit-delivery-atlas";
  const workflowYaml = await readFile(RELEASE_WORKFLOW, "utf8");
  const authorize = parseAuthorizeUses(workflowYaml);
  const host = `${authorize.owner}/${authorize.repo}`;
  const checks = [];

  console.log(`caller  ${callerSlug}`);
  console.log(`host    ${host}`);
  console.log(`path    ${authorize.path}`);
  console.log(`pin     ${authorize.ref}\n`);

  // 4. The pin must be an immutable commit SHA, not a tag or branch.
  if (!/^[0-9a-f]{40}$/.test(authorize.ref)) {
    fail(
      `The authorize job is pinned to "${authorize.ref}", which is not a 40-character commit SHA. ` +
        `A mutable tag or branch reference lets the trust boundary change without a commit here.`,
    );
  }
  checks.push("pin is a full commit SHA");

  const caller = await api(`/repos/${callerSlug}`);
  if (!caller.ok) fail(`Cannot read the caller repository ${callerSlug} (HTTP ${caller.status})`);

  const hostRepo = await api(`/repos/${host}`);
  if (!hostRepo.ok) {
    fail(
      `Cannot read the host repository ${host} (HTTP ${hostRepo.status}). ` +
        `If it was renamed, deleted, or made private, every release dispatch will be rejected.`,
    );
  }

  // 1. A public caller cannot use a reusable workflow from a private host.
  if (!caller.body.private && hostRepo.body.private) {
    fail(
      `${callerSlug} is public but ${host} is private. GitHub only shares actions and reusable ` +
        `workflows from a private repository with other private repositories owned by the same ` +
        `account, so every "release" dispatch will be rejected with HTTP 422 "workflow was not ` +
        `found" and no run record will be created. This is the exact failure that took ` +
        `${RELEASE_WORKFLOW} out of service before 2026-08-08.`,
    );
  }
  checks.push(`host visibility (${hostRepo.body.visibility}) is usable from a ${caller.body.visibility} caller`);

  // 2. The pinned commit must still resolve in the host repository.
  const commit = await api(`/repos/${host}/commits/${authorize.ref}`);
  if (!commit.ok) {
    fail(
      `The pinned commit ${authorize.ref} no longer resolves in ${host} (HTTP ${commit.status}). ` +
        `An unreachable commit can be garbage-collected, after which the release cannot start.`,
    );
  }
  checks.push("pinned commit resolves in the host repository");

  // 3. The reusable workflow must still exist at that pin and still honour the
  //    input and output contract release.yml is written against.
  const contents = await api(
    `/repos/${host}/contents/${encodeURI(authorize.path)}?ref=${authorize.ref}`,
  );
  if (!contents.ok) {
    fail(
      `${authorize.path} does not exist in ${host} at ${authorize.ref} (HTTP ${contents.status}).`,
    );
  }
  const reusableYaml = Buffer.from(contents.body.content, "base64").toString("utf8");
  const contract = parseWorkflowCallContract(reusableYaml);

  const missingOutputs = REQUIRED_OUTPUTS.filter((name) => !contract.outputs.includes(name));
  if (missingOutputs.length > 0) {
    fail(
      `The reusable workflow at ${authorize.ref} no longer declares the output(s) ` +
        `${missingOutputs.join(", ")}. ${RELEASE_WORKFLOW} reads them as ` +
        `needs.authorize.outputs.*; an undeclared output evaluates to the empty string, so the ` +
        `build job would check out an unspecified ref instead of failing.`,
    );
  }
  const missingInputs = REQUIRED_INPUTS.filter((name) => !contract.inputs.includes(name));
  if (missingInputs.length > 0) {
    fail(`The reusable workflow at ${authorize.ref} no longer accepts the input(s) ${missingInputs.join(", ")}.`);
  }
  checks.push(`workflow_call contract still declares ${REQUIRED_OUTPUTS.join(", ")}`);

  // 5. The reusable workflow verifies the tag signature against an allowed-signers
  //    file that lives in *this* repository, so a rename here breaks authorization
  //    from the caller side.
  const declared = authorize.with.get("allowed-signers-path");
  const defaultMatch = /allowed-signers-path:[\s\S]{0,400}?default:\s*["']?([^"'\s]+)["']?/.exec(reusableYaml);
  const signersPath = declared || (defaultMatch ? defaultMatch[1] : null);
  if (!signersPath) {
    fail(
      `Could not determine which allowed-signers file the reusable workflow will require: ` +
        `${RELEASE_WORKFLOW} sets no "allowed-signers-path" and the reusable workflow declares no default.`,
    );
  }
  if (!(await fileExists(signersPath))) {
    fail(
      `The reusable workflow will look for "${signersPath}" in this repository and fail the ` +
        `authorize job if it is absent, but that file is not present in the working tree.`,
    );
  }
  checks.push(`caller-side allowed-signers file ${signersPath} is present`);

  for (const line of checks) console.log(`ok  ${line}`);
  console.log(`\nRelease authorization dependency is intact (${checks.length} checks).`);
}

// Only reach the network when run as a program. The two parsers above are
// imported directly by tests/release-authorization.test.mjs. Both sides go
// through realpath so an invocation via a symlinked path (macOS /tmp, a
// node_modules/.bin shim) still counts as running this file directly.
function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().catch((error) => {
    if (error instanceof CheckFailure) {
      console.error(`\nRELEASE AUTHORIZATION CHECK FAILED\n\n${error.message}\n`);
    } else {
      console.error(`\nRELEASE AUTHORIZATION CHECK ERRORED\n\n${error?.stack || error}\n`);
    }
    process.exitCode = 1;
  });
}
