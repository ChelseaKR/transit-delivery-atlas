// Numbers that documentation states about the dataset, re-derived from the dataset.
//
// AGENTS.md rules that a figure is only as good as the record behind it, and the
// repository already holds itself to that for exports and for the corpus. The docs
// were outside it. `docs/RELATIONSHIP-MODEL.md` states six counts read off `data/`;
// `docs/BRAND.md` puts three more inside a layout sketch. Nothing read any of them
// back, and `.github/workflows/quality.yml` ignores `docs/**`, so a pull request
// that changed only these files ran no job at all.
//
// Two of the six had drifted by the time this file was written: BRAND.md's sketch
// said "2 records" and "E 2" while the evidence collection had grown to four
// records, all four of them linked to directive 5. The page renders those two
// numbers live from the same data, so the sketch had been describing a page that
// no longer existed.
//
// The figures are matched by regular expression against the sentence that carries
// them, not merely looked for somewhere in the file. A match failure is therefore
// two findings at once: the number is wrong, or the sentence that was supposed to
// state it has been rewritten away, and the second is as much a reason to stop as
// the first. That is why each assertion names which sentence it could not find.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

async function readDoc(path) {
  return readFile(new URL(path, root), "utf8");
}

/** The one number a pattern captures, as an integer, or a failure naming the file. */
function figure(text, pattern, where) {
  const match = text.match(pattern);
  assert.ok(
    match,
    `${where} no longer states the sentence this figure was read from: ${pattern}`,
  );
  return Number.parseInt(match[1].replace(/,/g, ""), 10);
}

const [directiveData, analysisData, organizations, evidenceData] =
  await Promise.all([
    readJson("data/directives.json"),
    readJson("data/analysis.json"),
    readJson("data/organizations.json"),
    readJson("data/evidence.json"),
  ]);

const directives = directiveData.directives;
const analysis = analysisData.analysis;

// Layer 1 of docs/RELATIONSHIP-MODEL.md: the links stated in the signed source.
const SOURCE_ROLE_FIELDS = [
  "leadOrgIds",
  "collaboratorOrgIds",
  "mentionedOrgIds",
];

function sourceRoleLinks() {
  let links = 0;
  const bodies = new Set();
  for (const directive of directives) {
    for (const field of SOURCE_ROLE_FIELDS) {
      for (const orgId of directive[field] ?? []) {
        links += 1;
        bodies.add(orgId);
      }
    }
  }
  return { links, bodies };
}

// Layer 2: the references stated in the independent analysis. A pair is unique by
// the two directives it joins regardless of direction, and reciprocal when each
// side names the other, which is the definition the document itself gives.
function analyticalReferences() {
  let statements = 0;
  let references = 0;
  const directed = new Set();
  const pairs = new Set();
  for (const record of analysis) {
    for (const dependency of record.dependencies ?? []) {
      statements += 1;
      for (const related of dependency.relatedDirectiveIds ?? []) {
        references += 1;
        directed.add(`${record.directiveId}>${related}`);
        pairs.add([record.directiveId, related].sort().join("|"));
      }
    }
  }
  let reciprocal = 0;
  for (const pair of pairs) {
    const [left, right] = pair.split("|");
    if (directed.has(`${left}>${right}`) && directed.has(`${right}>${left}`)) {
      reciprocal += 1;
    }
  }
  return { statements, references, pairs: pairs.size, reciprocal };
}

test("RELATIONSHIP-MODEL states the source-role links the directives actually carry", async () => {
  const doc = await readDoc("docs/RELATIONSHIP-MODEL.md");
  const { links, bodies } = sourceRoleLinks();
  const where = "docs/RELATIONSHIP-MODEL.md";

  assert.equal(
    figure(doc, /dataset contains ([\d,]+) such links/, where),
    links,
    `${where} states a source-role link count the directives do not carry`,
  );
  assert.equal(
    figure(doc, /such links across ([\d,]+) body and role-group/, where),
    bodies.size,
    `${where} states a body count the directives do not name`,
  );
  // Every body the directives name has to be a record, or the doc is counting
  // references to organizations that do not exist.
  const known = new Set(organizations.map((org) => org.id));
  for (const id of bodies) {
    assert.ok(known.has(id), `${id} is named by a directive but is not in data/organizations.json`);
  }
});

test("RELATIONSHIP-MODEL states the analytical layer the analysis actually contains", async () => {
  const doc = await readDoc("docs/RELATIONSHIP-MODEL.md");
  const { statements, references, pairs, reciprocal } = analyticalReferences();
  const where = "docs/RELATIONSHIP-MODEL.md";

  assert.equal(
    figure(doc, /analytical layer contains ([\d,]+)\s+dependency statements/, where),
    statements,
    `${where} states a dependency-statement count the analysis does not contain`,
  );
  assert.equal(
    figure(doc, /dependency statements and ([\d,]+)\s*\n?\s*cross-references/, where),
    references,
    `${where} states a cross-reference count the analysis does not contain`,
  );
  // These two are the reason this test exists. Until it was written, "15 unique
  // pairs" and "12 of which are reciprocal" appeared nowhere else in the
  // repository: no other test, no other document, no code path. They were the only
  // published figures here with nothing at all behind them.
  assert.equal(
    figure(doc, /references form ([\d,]+) unique directive pairs/, where),
    pairs,
    `${where} states a unique-pair count the analysis does not produce`,
  );
  assert.equal(
    figure(doc, /unique directive pairs, ([\d,]+) of which\s*\n?\s*are reciprocal/, where),
    reciprocal,
    `${where} states a reciprocal-pair count the analysis does not produce`,
  );
});

test("the BRAND layout sketch states the totals the home page renders", async () => {
  const doc = await readDoc("docs/BRAND.md");
  const where = "docs/BRAND.md";

  // app/page.tsx renders directives.length and evidenceRecords.length into the
  // "Atlas record totals" list. The sketch is a picture of that list, so it is a
  // hand-copy of two live figures and drifts the moment either one moves.
  assert.equal(
    figure(doc, /Transit Delivery Atlas\s+([\d,]+) directives/, where),
    directives.length,
    `${where} sketches a directive total the home page does not render`,
  );
  assert.equal(
    figure(doc, /directives · ([\d,]+) records/, where),
    evidenceData.evidence.length,
    `${where} sketches an evidence total the home page does not render`,
  );

  // The sketch's evidence column shows a per-directive link count for directive 5.
  // An empty state is drawn as a dash and is deliberately not a number, which the
  // prose under the sketch explains; only the counted row is checked here.
  const linksByDirective = new Map();
  for (const record of evidenceData.evidence) {
    for (const link of record.directiveLinks ?? []) {
      const id = link.directiveId;
      linksByDirective.set(id, (linksByDirective.get(id) ?? 0) + 1);
    }
  }
  assert.equal(
    figure(doc, /Funding programs.*?E ([\d,]+)\s+A/s, where),
    linksByDirective.get("n-7-26-5") ?? 0,
    `${where} sketches an evidence-link count directive 5 does not have`,
  );
});
