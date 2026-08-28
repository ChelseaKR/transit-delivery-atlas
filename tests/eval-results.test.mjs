import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { PROMPT_VERSION } from "../service/schemas.ts";

/**
 * A number without provenance is not a result. Every committed result file
 * must name the provider, model, prompt version, commit, and date that produced
 * it, and a suite that was not run live must say so instead of carrying
 * numbers. A result produced by the dry-run provider can never be committed.
 *
 * Two rules keep the audit from being answerable by the thing it audits:
 *
 * 1. Zero tolerance is declared by the committed case file, never by the
 *    result. A result that certifies its own tolerance can drop the flag and
 *    record failures in a suite AGENTS.md says has "zero tolerance".
 * 2. The work set is the committed case suites, not the contents of
 *    `evals/results/`. A loop over that directory validates nothing when it is
 *    empty, and deleting the files is otherwise an easier way to satisfy the
 *    prompt-version gate than re-running the suites.
 */

const root = new URL("../", import.meta.url);
const resultsDir = new URL("evals/results/", root);
const casesDir = new URL("evals/cases/", root);

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

export function validateResultFile(name, result, caseFile) {
  const problems = [];
  if (result.suite !== name.replace(/\.json$/, "")) problems.push("suite name does not match the file name");
  if (!caseFile) problems.push("no committed case file names this suite, so its numbers cross-check against nothing");
  if (typeof result.ran !== "boolean") problems.push("ran must be a boolean");
  const p = result.provenance;
  if (!p || typeof p !== "object") problems.push("provenance is missing");
  else {
    for (const field of ["provider", "model", "promptVersion", "commit", "date"]) {
      if (typeof p[field] !== "string" || p[field].trim() === "") problems.push(`provenance.${field} is missing`);
    }
    if (p.provider && !["anthropic", "bedrock"].includes(p.provider)) problems.push(`provenance.provider ${JSON.stringify(p.provider)} is not a live provider`);
    if (p.model && /dry-run|fake|scripted/i.test(p.model)) problems.push("provenance.model is a fake");
    if (p.commit && !/^[0-9a-f]{40}$/.test(p.commit)) problems.push("provenance.commit is not a full commit SHA");
    if (p.date && !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) problems.push("provenance.date is not an ISO date");
  }
  if (result.ran) {
    if (result.live !== true) problems.push("a ran result must be live");
    const m = result.metrics;
    if (!m || typeof m !== "object") problems.push("metrics are missing");
    else {
      for (const field of ["cases", "passed", "failed", "passRate"]) {
        if (typeof m[field] !== "number" || Number.isNaN(m[field])) problems.push(`metrics.${field} is not a number`);
      }
      if (m.cases !== undefined && caseFile && m.cases !== caseFile.cases.length) {
        problems.push(`metrics.cases (${m.cases}) does not match the committed case file (${caseFile.cases.length})`);
      }
      if (m.passed !== undefined && m.failed !== undefined && m.cases !== undefined && m.passed + m.failed !== m.cases) problems.push("passed + failed != cases");
    }
    if (!Array.isArray(result.cases) || result.cases.length === 0) problems.push("per-case results are missing");
    else {
      for (const c of result.cases) {
        if (typeof c.pass !== "boolean") problems.push(`case ${c.id} has no pass/fail`);
        if (typeof c.question !== "string") problems.push(`case ${c.id} has no question`);
      }
    }
    // The committed case file declares the tolerance. Reading the flag off the
    // result being audited lets a result drop it and record failures anyway.
    const zeroTolerance = caseFile ? caseFile.zeroTolerance === true : result.zeroTolerance === true;
    if (zeroTolerance && result.metrics?.passed !== result.metrics?.cases) {
      problems.push("a zero-tolerance suite is committed with a failure; it must be fixed, not recorded as passing elsewhere");
    }
    if (caseFile && result.zeroTolerance !== undefined && result.zeroTolerance !== zeroTolerance) {
      problems.push(`result declares zeroTolerance ${result.zeroTolerance}, the committed case file declares ${zeroTolerance}`);
    }
  } else {
    if (result.metrics && Object.keys(result.metrics).length > 0) problems.push("a suite that was not run carries metrics");
    if (typeof result.reason !== "string" || result.reason.trim() === "") problems.push("a suite that was not run must say why");
  }
  return problems;
}

test("every committed eval result carries live provenance, and not-run suites carry no numbers", async () => {
  const suites = (await readdir(casesDir)).filter((file) => file.endsWith(".json"));
  const results = (await readdir(resultsDir)).filter((file) => file.endsWith(".json"));
  assert.ok(suites.length >= 5, "five suites are committed");

  // The committed suites are the work set. Looping over results/ instead means
  // an empty directory validates nothing and passes, and deleting a stale
  // result satisfies the prompt-version gate without re-running anything.
  for (const file of suites) {
    assert.ok(
      results.includes(file),
      `${file} is a committed suite with no result file; a suite that was not run live must say so, not go missing`,
    );
    const result = await readJson(new URL(file, resultsDir));
    const caseFile = await readJson(new URL(file, casesDir));
    assert.deepEqual(validateResultFile(file, result, caseFile), [], `${file} is not a valid result file`);
    if (result.ran) {
      assert.equal(result.provenance.promptVersion, PROMPT_VERSION, `${file} was produced by another prompt version; re-run or mark not run`);
    }
  }

  for (const file of results) {
    assert.ok(suites.includes(file), `${file} records a suite with no committed case file`);
  }
});

test("the validator rejects a result without provenance, with fake provenance, or with numbers but no run", () => {
  const cases = { cases: [{}], zeroTolerance: true };
  const good = {
    suite: "freshness",
    ran: true,
    live: true,
    provenance: { provider: "bedrock", model: "global.anthropic.claude-sonnet-4-6", promptVersion: PROMPT_VERSION, commit: "a".repeat(40), date: "2026-08-21" },
    zeroTolerance: true,
    metrics: { cases: 1, passed: 1, failed: 0, passRate: 1 },
    cases: [{ id: "x", question: "q", pass: true }],
  };
  assert.deepEqual(validateResultFile("freshness.json", good, cases), []);
  assert.ok(validateResultFile("freshness.json", { ...good, provenance: undefined }, cases).length > 0);
  assert.ok(validateResultFile("freshness.json", { ...good, provenance: { ...good.provenance, model: "dry-run" } }, cases).some((p) => /fake/.test(p)));
  assert.ok(validateResultFile("freshness.json", { ...good, provenance: { ...good.provenance, commit: "abc" } }, cases).some((p) => /commit/.test(p)));
  assert.ok(validateResultFile("freshness.json", { ...good, ran: false }, cases).some((p) => /carries metrics/.test(p)));
  assert.ok(validateResultFile("freshness.json", { ...good, metrics: { ...good.metrics, passed: 0 } }, cases).some((p) => /zero-tolerance/.test(p)));
  assert.deepEqual(validateResultFile("freshness.json", { suite: "freshness", ran: false, reason: "not run live", provenance: good.provenance }, cases), []);
});

test("a result cannot certify its own tolerance", () => {
  // The suite the case file declares zero-tolerance, recording eight failures
  // and simply omitting the flag from the result it ships.
  const declaredZeroTolerance = { cases: new Array(48).fill({}), zeroTolerance: true };
  const withFailures = {
    suite: "compliance-refusal",
    ran: true,
    live: true,
    provenance: { provider: "bedrock", model: "global.anthropic.claude-sonnet-4-6", promptVersion: PROMPT_VERSION, commit: "b".repeat(40), date: "2026-08-22" },
    metrics: { cases: 48, passed: 40, failed: 8, passRate: 40 / 48 },
    cases: [{ id: "x", question: "q", pass: false }],
  };

  assert.ok(
    validateResultFile("compliance-refusal.json", withFailures, declaredZeroTolerance).some((p) => /zero-tolerance/.test(p)),
    "the committed case file declares the tolerance, so dropping the flag must not clear the check",
  );
  assert.ok(
    validateResultFile("compliance-refusal.json", { ...withFailures, zeroTolerance: false }, declaredZeroTolerance).some((p) => /disagrees|declares/.test(p)),
    "a result contradicting the committed case file must be rejected",
  );
});

test("a result with no committed case file cross-checks against nothing", () => {
  const orphan = {
    suite: "freshness",
    ran: true,
    live: true,
    provenance: { provider: "bedrock", model: "global.anthropic.claude-sonnet-4-6", promptVersion: PROMPT_VERSION, commit: "c".repeat(40), date: "2026-08-22" },
    metrics: { cases: 48, passed: 48, failed: 0, passRate: 1 },
    cases: [{ id: "x", question: "q", pass: true }],
  };
  assert.ok(validateResultFile("freshness.json", orphan, null).some((p) => /no committed case file/.test(p)));
});

test("the case suites themselves are well formed and cover the five commitments", async () => {
  const expected = ["citation-grounding", "compliance-refusal", "empty-state", "freshness", "structuring"];
  for (const name of expected) {
    const suite = await readJson(new URL(`${name}.json`, casesDir));
    assert.ok(suite.description.length > 40, name);
    assert.ok(suite.cases.length >= 10, `${name} has at least ten cases`);
    const ids = suite.cases.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length, `${name} case IDs are unique`);
  }
  const refusal = await readJson(new URL("compliance-refusal.json", casesDir));
  assert.equal(refusal.zeroTolerance, true);
  assert.ok(refusal.cases.length >= 40, "the refusal suite covers many phrasings");
  const empty = await readJson(new URL("empty-state.json", casesDir));
  assert.equal(empty.zeroTolerance, true);
});
