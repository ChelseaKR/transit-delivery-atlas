import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("public JSON and CSV contain the same 21 directive IDs", async () => {
  const [json, csv] = await Promise.all([
    readJson("public/data/directives.json"),
    readFile(new URL("public/data/directives.csv", root), "utf8"),
  ]);

  assert.equal(json.directives.length, 21);
  const csvLines = csv.trim().split("\n");
  assert.equal(csvLines.length, 22);

  const csvIds = csvLines.slice(1).map((line) => line.match(/^"([^"]+)"/)?.[1]);
  assert.deepEqual(csvIds, json.directives.map(({ id }) => id));

  const header = csvLines[0];
  for (const column of [
    "schema_version",
    "source_id",
    "title_origin",
    "analysis_summary",
    "analysis_themes",
    "source_context_ids",
    "qualifiers",
    "source_notes",
  ]) {
    assert.match(header, new RegExp(`"${column}"`));
  }
});

test("only Section 1 carries explicit timing and 1(e) carries two milestones", async () => {
  const json = await readJson("public/data/directives.json");
  for (const directive of json.directives) {
    const isSectionOne = /^n-7-26-1[a-g]$/.test(directive.id);
    if (isSectionOne) {
      assert.ok(directive.timing.some(({ derivedDate }) => derivedDate === "2026-10-24"));
    } else {
      assert.equal(directive.timing.length, 0, directive.id);
    }
  }

  const section1e = json.directives.find(({ id }) => id === "n-7-26-1e");
  assert.deepEqual(
    section1e.timing.map(({ derivedDate }) => derivedDate),
    ["2026-10-24", "2027-06-26"],
  );
});

test("every public record retains source and inference provenance", async () => {
  const json = await readJson("public/data/directives.json");
  for (const directive of json.directives) {
    assert.equal(directive.titleOrigin, "editorial");
    assert.ok(directive.sourceUrl.startsWith("https://www.gov.ca.gov/"));
    assert.ok(directive.locator.section);
    assert.ok(directive.locator.pages.length > 0);
    assert.ok(directive.excerpt.length > 20);
    assert.ok(Array.isArray(directive.sourceContextIds));
    assert.ok(
      directive.qualifiers.every(
        ({ text, appliesTo }) => typeof text === "string" && typeof appliesTo === "string",
      ),
    );
    assert.ok(Array.isArray(directive.sourceNotes));
    assert.ok(directive.analysis.expectedOutputs.length > 0);
    assert.ok(directive.analysis.expectedOutputs.every(({ origin }) => origin === "inferred"));
    assert.ok(directive.analysis.dependencies.every(({ origin }) => origin === "inferred"));
  }
});

test("order-level source context and legal notice are preserved", async () => {
  const json = await readJson("public/data/directives.json");
  const sectionThree = json.orderMetadata.sourceContexts.find(
    ({ id }) => id === "section-3-preamble",
  );
  assert.ok(sectionThree);
  assert.equal(sectionThree.appliesToDirectiveIds.length, 10);
  assert.ok(sectionThree.mentionedOrgIds.includes("cimp"));

  const nonEnforceability = json.orderMetadata.sourceNotices.find(
    ({ id }) => id === "non-enforceability",
  );
  assert.match(nonEnforceability.excerpt, /does not, create any rights or benefits/);
  assert.match(nonEnforceability.excerpt, /enforceable at law or in equity/);
});

test("source-fidelity corrections retain compound actions and precise relationships", async () => {
  const json = await readJson("public/data/directives.json");
  const records = new Map(json.directives.map((directive) => [directive.id, directive]));

  assert.equal(json.directives.filter(({ id }) => id === "n-7-26-3b").length, 1);

  const sectionThreeF = records.get("n-7-26-3f");
  assert.match(sectionThreeF.excerpt, /fully digitize its real estate holdings/);
  assert.match(sectionThreeF.excerpt, /inventory buildings and their state of repair/);
  assert.doesNotMatch(sectionThreeF.analysis.openQuestions.join(" "), /only a plan/i);

  const sectionFour = records.get("n-7-26-4");
  assert.deepEqual(
    sectionFour.qualifiers.find(({ text }) => text === "where possible"),
    {
      text: "where possible",
      appliesTo: "undertaking programmatic environmental review",
    },
  );

  const sectionFive = records.get("n-7-26-5");
  assert.deepEqual(sectionFive.leadOrgIds, ["calsta", "caltrans"]);
  assert.match(sectionFive.excerpt, /Caltrans shall also identify federal funding programs/);

  assert.deepEqual(records.get("n-7-26-3a").collaboratorOrgIds, []);
  assert.ok(records.get("n-7-26-3a").mentionedOrgIds.includes("regions"));
  assert.deepEqual(records.get("n-7-26-3d").collaboratorOrgIds, []);
  assert.ok(records.get("n-7-26-3e").mentionedOrgIds.includes("local-agencies"));
  assert.deepEqual(records.get("n-7-26-6").collaboratorOrgIds, ["caltrans-it"]);
});

test("public schema is controlled and closes every typed object", async () => {
  const schema = await readJson("data/public-schema.json");
  assert.equal(schema.$id, "urn:transit-delivery-atlas:data-schema:0.1.0");

  function inspect(node, path = "$") {
    if (!node || typeof node !== "object") return;
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false, path);
    }
    for (const [key, child] of Object.entries(node)) {
      inspect(child, `${path}.${key}`);
    }
  }

  inspect(schema);
});
