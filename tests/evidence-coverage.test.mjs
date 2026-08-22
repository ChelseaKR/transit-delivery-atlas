import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COVERAGE_NOT_A_FINDING,
  coverageForDirectives,
  coverageStatement,
  directiveEvidenceCoverage,
} from "../lib/evidence-coverage.mjs";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const source = (overrides) => ({
  id: "example",
  name: "Example source",
  publisher: "Example",
  url: "https://example.gov/",
  coversDirectiveIds: ["n-7-26-1a"],
  lastCheckedOn: "2026-08-21",
  lastCheckOutcome: "checked",
  note: "Checked for the test fixture.",
  ...overrides,
});

const collection = (overrides) => ({
  lastUpdatedOn: "2026-08-21",
  nextReviewOn: "2026-09-18",
  reviewSources: [],
  evidence: [],
  ...overrides,
});

test("a directive with no evidence and a checked source is 'checked, nothing found'", () => {
  const coverage = directiveEvidenceCoverage(
    "n-7-26-1a",
    collection({ reviewSources: [source({ id: "a", lastCheckedOn: "2026-08-01" }), source({ id: "b" })] }),
  );
  assert.equal(coverage.state, "checked-none-found");
  assert.equal(coverage.evidenceCount, 0);
  assert.equal(coverage.lastCheckedOn, "2026-08-21", "the latest successful check wins");
  assert.equal(coverage.checkedSources.length, 2);
  assert.equal(coverage.failedSources.length, 0);

  const statement = coverageStatement(coverage);
  assert.match(statement, /No reviewed public artifact is linked to this directive\./);
  assert.match(statement, /2 listed public sources covering it were last checked on 2026-08-21/);
  assert.match(statement, /no artifact citing the order was found there/);
  assert.match(statement, /next planned check of the listed sources is 2026-09-18/);
  assert.ok(statement.endsWith(COVERAGE_NOT_A_FINDING));
});

test("a directive whose only covering sources failed retrieval is 'not yet reviewed'", () => {
  const coverage = directiveEvidenceCoverage(
    "n-7-26-4",
    collection({
      reviewSources: [
        source({ id: "chsra", name: "CHSRA newsroom", coversDirectiveIds: ["n-7-26-4"], lastCheckOutcome: "retrieval-failed" }),
      ],
    }),
  );
  assert.equal(coverage.state, "not-yet-reviewed");
  assert.equal(coverage.lastCheckedOn, null);
  const statement = coverageStatement(coverage);
  assert.match(statement, /no listed public source covering it has been successfully checked yet/);
  assert.match(statement, /1 listed source covering this directive \(CHSRA newsroom\) could not be retrieved/);
  assert.ok(statement.endsWith(COVERAGE_NOT_A_FINDING));
});

test("a directive with no covering source at all is also 'not yet reviewed'", () => {
  const coverage = directiveEvidenceCoverage("n-7-26-2", collection({ reviewSources: [source()] }));
  assert.equal(coverage.state, "not-yet-reviewed");
  assert.equal(coverage.checkedSources.length, 0);
  assert.doesNotMatch(coverageStatement(coverage), /could not be retrieved/);
});

test("a linked directive reports its count and the date its sources were checked", () => {
  const coverage = directiveEvidenceCoverage(
    "n-7-26-5",
    collection({
      reviewSources: [source({ coversDirectiveIds: ["n-7-26-5"] })],
      evidence: [
        { directiveLinks: [{ directiveId: "n-7-26-5" }] },
        { directiveLinks: [{ directiveId: "n-7-26-5" }, { directiveId: "n-7-26-1a" }] },
        { directiveLinks: [{ directiveId: "n-7-26-1a" }] },
      ],
    }),
  );
  assert.equal(coverage.state, "linked");
  assert.equal(coverage.evidenceCount, 2);
  const statement = coverageStatement(coverage);
  assert.match(statement, /^2 reviewed public artifacts are linked to this directive\./);
  assert.match(statement, /1 listed public source covering it was last checked on 2026-08-21/);
  assert.doesNotMatch(statement, /not evidence that no implementation/);
});

test("no coverage statement ever renders a status verdict", () => {
  const states = [
    directiveEvidenceCoverage("n-7-26-1a", collection({ reviewSources: [source()] })),
    directiveEvidenceCoverage("n-7-26-1a", collection({ reviewSources: [source({ lastCheckOutcome: "retrieval-failed" })] })),
    directiveEvidenceCoverage("n-7-26-1a", collection({ reviewSources: [source()], evidence: [{ directiveLinks: [{ directiveId: "n-7-26-1a" }] }] })),
  ];
  for (const coverage of states) {
    const statement = coverageStatement(coverage);
    assert.doesNotMatch(statement, /compl(y|ied|iance|ete)|on track|behind|late|overdue|met |missed|nothing has happened/i, statement);
  }
});

test("a bad date in the collection fails loudly rather than rendering", () => {
  assert.throws(
    () => directiveEvidenceCoverage("n-7-26-1a", collection({ nextReviewOn: "2026-13-01" })),
    /nextReviewOn must be a real ISO calendar date/,
  );
  assert.throws(
    () => directiveEvidenceCoverage("n-7-26-1a", collection({ reviewSources: [source({ lastCheckedOn: "soon" })] })),
    /lastCheckedOn must be a real ISO calendar date/,
  );
  assert.throws(() => directiveEvidenceCoverage("", collection()), /needs a directive ID/);
});

test("the committed data yields one explicit state for every directive", async () => {
  const [evidenceData, directiveData] = await Promise.all([
    readJson("data/evidence.json"),
    readJson("data/directives.json"),
  ]);
  const coverage = coverageForDirectives(
    directiveData.directives.map(({ id }) => id),
    evidenceData,
  );
  assert.equal(coverage.length, 21);
  const byState = Object.groupBy(coverage, ({ state }) => state);
  assert.ok((byState["linked"] ?? []).length >= 1, "directive 5 is linked");
  assert.ok(
    (byState["checked-none-found"] ?? []).length >= 19,
    "the 2026-08-21 sweep covered the other directives at a successfully checked source",
  );
  for (const item of coverage) {
    if (item.state === "checked-none-found") {
      assert.equal(item.lastCheckedOn, evidenceData.lastUpdatedOn, item.directiveId);
    }
  }
  // Directive 4's only dedicated source failed retrieval; it is still covered by
  // a checked general source, and the statement says both things.
  const four = coverage.find(({ directiveId }) => directiveId === "n-7-26-4");
  assert.equal(four.state, "checked-none-found");
  assert.equal(four.failedSources.length, 1);
  assert.match(coverageStatement(four), /could not be retrieved/);
});
