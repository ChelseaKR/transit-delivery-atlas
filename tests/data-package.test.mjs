import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const dataDir = new URL("public/data/", root);

async function readJson(name) {
  return JSON.parse(await readFile(new URL(name, dataDir), "utf8"));
}

const dataPackage = await readJson("datapackage.json");
const dcat = await readJson("dcat.jsonld");

/**
 * Parse the exporter's CSV dialect: every cell quoted, `""` for a literal quote, and no
 * embedded newlines. Written here rather than imported so the test reads the published
 * bytes the way a consumer would, not the way the writer produced them.
 */
function parseCsv(text) {
  return text
    .trimEnd()
    .split("\n")
    .map((line) => {
      const cells = [];
      let cell = "";
      let inQuotes = false;
      for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
          if (inQuotes && line[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (character === "," && !inQuotes) {
          cells.push(cell);
          cell = "";
        } else {
          cell += character;
        }
      }
      cells.push(cell);
      return cells;
    });
}

const tabularResources = dataPackage.resources.filter(
  (resource) => resource.profile === "tabular-data-resource",
);

test("the data package describes every published export, and nothing it does not publish", async () => {
  const published = new Set([
    "directives.json",
    "directives.csv",
    "evidence.csv",
    "watchlist.json",
    "watchlist.csv",
    "watchlist-schema.json",
    "directive-organizations.csv",
    "directive-relationships.csv",
    "schema.json",
    "tda-ntd-feasibility.json",
  ]);
  const described = new Set(dataPackage.resources.map((resource) => resource.path));

  assert.deepEqual(
    [...described].sort(),
    [...published].sort(),
    "a published export with no resource is undocumented, and a resource with no export is a broken link",
  );
  // Every described file has to exist, or the package points a harvester at a 404.
  for (const path of described) {
    await readFile(new URL(path, dataDir), "utf8");
  }
});

test("every Table Schema names the columns its CSV actually has, in order", async () => {
  assert.ok(tabularResources.length > 0, "no tabular resources: this check would be vacuous");
  for (const resource of tabularResources) {
    const [header] = parseCsv(await readFile(new URL(resource.path, dataDir), "utf8"));
    assert.deepEqual(
      resource.schema.fields.map((field) => field.name),
      header,
      `${resource.path}: the Table Schema and the CSV header disagree`,
    );
  }
});

test("every declared type and required constraint holds for every published row", async () => {
  let checked = 0;
  for (const resource of tabularResources) {
    const [, ...rows] = parseCsv(await readFile(new URL(resource.path, dataDir), "utf8"));
    assert.ok(rows.length > 0, `${resource.path} has no rows; this check would be vacuous`);
    for (const row of rows) {
      resource.schema.fields.forEach((field, index) => {
        const value = row[index];
        checked += 1;
        if (value === "") {
          assert.equal(
            field.constraints.required,
            false,
            `${resource.path}: ${field.name} is declared required but a row leaves it empty`,
          );
          return;
        }
        if (field.type === "date") {
          assert.match(
            value,
            /^\d{4}-\d{2}-\d{2}$/,
            `${resource.path}: ${field.name} is declared a date but holds ${JSON.stringify(value)}`,
          );
          assert.ok(
            !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
            `${resource.path}: ${field.name} holds an unparseable date ${JSON.stringify(value)}`,
          );
        } else if (field.type === "integer") {
          assert.match(value, /^-?\d+$/, `${resource.path}: ${field.name} is not an integer`);
        } else if (field.type === "boolean") {
          assert.ok(
            value === "true" || value === "false",
            `${resource.path}: ${field.name} is declared boolean but holds ${JSON.stringify(value)}`,
          );
        }
      });
    }
  }
  assert.ok(checked > 500, `only ${checked} cells checked; the sweep is not covering the exports`);
});

test("a required constraint is only claimed where the column is genuinely always present", async () => {
  // The inverse of the check above, and the one that stops `required: true` from being a
  // default that happens to hold. A column declared optional must have at least one empty
  // cell somewhere, otherwise the declaration is not describing this data.
  for (const resource of tabularResources) {
    const [, ...rows] = parseCsv(await readFile(new URL(resource.path, dataDir), "utf8"));
    resource.schema.fields.forEach((field, index) => {
      const empties = rows.filter((row) => row[index] === "").length;
      assert.equal(
        field.constraints.required,
        empties === 0,
        `${resource.path}: ${field.name} declares required=${field.constraints.required} with ${empties} empty cell(s)`,
      );
    });
  }
});

test("the licence split is stated, not collapsed into one identifier", () => {
  assert.equal(dataPackage.licenses[0].name, "CC-BY-4.0");
  assert.match(dataPackage.licenseNotes, /NOT relicensed/);
  assert.match(dataPackage.licenseNotes, /CONTENT-LICENSE\.md/);
  assert.match(dcat["dct:rights"], /NOT relicensed/);
});

test("provenance carries the signed source's retrieval date and hash", async () => {
  const sources = JSON.parse(await readFile(new URL("data/sources.json", root), "utf8"));
  assert.ok(dataPackage.sources.length > 0, "no sources: the provenance claim would be vacuous");
  for (const [index, entry] of dataPackage.sources.entries()) {
    assert.equal(entry.sourceId, sources[index].id);
    assert.equal(entry.retrievedOn, sources[index].retrievedOn);
    assert.equal(entry.sha256, sources[index].sha256);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
  }
});

test("no date in the package or the DCAT record is a build timestamp", async () => {
  // `datapackage.json` and `dcat.jsonld` are byte-compared against a fresh export, so a
  // value that moves with the build would fail the gate on every pull request and train
  // everyone to regenerate without reading. Every date here is a review date read off the
  // records; the build commit is published separately, in /version.json.
  const directives = await readJson("directives.json");
  assert.equal(dataPackage.created, directives.dataReviewedThrough);
  assert.equal(dataPackage.dataReviewedThrough, directives.dataReviewedThrough);
  assert.equal(dcat["dct:modified"], directives.dataReviewedThrough);
  assert.equal(dcat["dct:issued"], directives.source.retrievedOn);
  assert.match(dataPackage.buildCommit, /\/version\.json$/);

  const serialized = `${JSON.stringify(dataPackage)}${JSON.stringify(dcat)}`;
  assert.doesNotMatch(
    serialized,
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
    "a timestamp reached a byte-compared export; it will fail --check on the next build",
  );
});

test("every DCAT distribution points at a file the site actually publishes", async () => {
  const distributions = dcat["dcat:distribution"];
  assert.equal(distributions.length, dataPackage.resources.length);
  for (const distribution of distributions) {
    const url = new URL(distribution["dcat:downloadURL"]);
    assert.equal(url.origin, "https://transit.chelseakr.com");
    const name = url.pathname.replace(/^\/data\//, "");
    await readFile(new URL(name, dataDir), "utf8");
  }
});
