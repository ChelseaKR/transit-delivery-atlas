import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, root), "utf8");
}

async function readJson(path) {
  return JSON.parse(await readProjectFile(path));
}

async function renderedPage(path) {
  return readProjectFile(`out/${path}/index.html`);
}

function attributeValues(html, attribute) {
  return [...html.matchAll(new RegExp(`${attribute}="([^"]*)"`, "g"))].map((match) => match[1]);
}

function assertTextOrder(html, labels, context) {
  const positions = labels.map((label) => html.indexOf(label));
  for (let index = 0; index < positions.length; index += 1) {
    assert.notEqual(positions[index], -1, `${context}: missing ordered label ${labels[index]}`);
    if (index > 0) {
      assert.ok(
        positions[index - 1] < positions[index],
        `${context}: ${labels[index - 1]} must render before ${labels[index]}`,
      );
    }
  }
}

test("every registered body has a record page", async () => {
  const organizations = await readJson("data/organizations.json");

  assert.equal(organizations.length, 23, "the registry is 23 bodies and role groups");

  for (const organization of organizations) {
    const html = await renderedPage(`organizations/${organization.id}`);
    assert.match(
      html,
      new RegExp(`data-organization-id="${organization.id}"`),
      `${organization.id} renders someone else's record`,
    );
    assert.ok(html.includes(organization.name), `${organization.id} does not name itself`);
  }
});

test("the source-role links rendered across the pages total the links in the data", async () => {
  // The issue's figure, pinned to its literal. Counted twice on purpose: once from
  // the directive records, once from what the twenty-three pages actually render.
  // A property test over "the two agree" would pass if both became zero.
  const { directives } = await readJson("data/directives.json");
  const organizations = await readJson("data/organizations.json");

  const inData = directives.reduce(
    (total, directive) =>
      total +
      directive.leadOrgIds.length +
      directive.collaboratorOrgIds.length +
      directive.mentionedOrgIds.length,
    0,
  );
  assert.equal(inData, 50, "the signed instrument carries 50 source-role links");

  let rendered = 0;
  for (const organization of organizations) {
    const html = await renderedPage(`organizations/${organization.id}`);
    rendered += attributeValues(html, "data-appearances").reduce(
      (total, value) => total + Number(value),
      0,
    );
  }

  assert.equal(rendered, 50, "the pages between them must render every link and no more");
});

test("a role group states its kind and fabricates no evidence section", async () => {
  const html = await renderedPage("organizations/local-partners");

  assert.ok(html.includes("Named role group"), "the registry kind has to be stated");
  assert.match(html, /data-evidence-records="0"/);
  assert.ok(
    html.includes("No reviewed public artifact in the current release carries this"),
    "an empty evidence layer must say so in words, not render an empty list",
  );
  assert.ok(
    !html.includes("evidence-card"),
    "no artifact card may appear on a body nothing is published under",
  );
});

test("evidence is attributed by an exact publisher match and nothing looser", async () => {
  const evidence = await readJson("data/evidence.json");
  const organizations = await readJson("data/organizations.json");
  const publishers = new Set(evidence.evidence.map((record) => record.publisher));

  const expected = organizations.filter((organization) => publishers.has(organization.name));
  assert.equal(expected.length, 1, "exactly one registry name matches a publisher today");

  for (const organization of organizations) {
    const html = await renderedPage(`organizations/${organization.id}`);
    const [count] = attributeValues(html, "data-evidence-records");
    const matching = evidence.evidence.filter(
      (record) => record.publisher === organization.name,
    ).length;
    assert.equal(
      Number(count),
      matching,
      `${organization.id} lists ${count} artifacts and exactly ${matching} name it as publisher`,
    );
  }
});

test("every record page renders the layers in the order the directive page uses", async () => {
  const organizations = await readJson("data/organizations.json");

  for (const organization of organizations) {
    const html = await renderedPage(`organizations/${organization.id}`);
    // The layer-label class, not the label text. "Independent analysis" is also
    // the first two words of the independence badge in the hero, so an order
    // asserted over the prose passes on a page whose layers are in any order.
    assertTextOrder(
      html,
      ["layer-label--source", "layer-label--evidence", "layer-label--analysis"],
      organization.id,
    );
    assert.ok(
      html.includes("Independent analysis · Unofficial"),
      `${organization.id} must carry the independence badge`,
    );
  }
});

test("the index states totals it derives, and lists every body once", async () => {
  const html = await renderedPage("organizations");
  const organizations = await readJson("data/organizations.json");

  for (const organization of organizations) {
    // The closing quote matters: without it `caltrans` also matches `caltrans-it`
    // and `caltrans-rail`, and the assertion counts three links as one body's.
    const href = `href="/organizations/${organization.id}/"`;
    const occurrences = html.split(href).length - 1;
    assert.equal(occurrences, 1, `${organization.id} must be linked exactly once from the index`);
  }

  assert.ok(html.includes(">23<"), "the registry total must be rendered");
  assert.ok(html.includes(">50<"), "the source-role link total must be rendered");
});

test("organizations.csv has one row per registry member", async () => {
  const csv = await readProjectFile("public/data/organizations.csv");
  const organizations = await readJson("data/organizations.json");
  const rows = csv.trim().split("\n");

  assert.equal(rows.length - 1, organizations.length, "one header plus one row per member");
  assert.equal(rows.length - 1, 23);

  const ids = rows.slice(1).map((row) => row.split(",")[1].replaceAll('"', ""));
  assert.deepEqual(
    [...ids].sort(),
    organizations.map(({ id }) => id).sort(),
    "the export and the registry must hold the same members",
  );

  const linkColumn = rows[0].split(",").indexOf('"source_role_links"');
  assert.notEqual(linkColumn, -1, "the export must carry a source-role link count");
  const total = rows
    .slice(1)
    .reduce((sum, row) => sum + Number(row.split(",")[linkColumn].replaceAll('"', "")), 0);
  assert.equal(total, 50, "the export's link counts must total the links in the instrument");
});

test("the data package describes the registry export", async () => {
  const dataPackage = await readJson("public/data/datapackage.json");
  const resource = dataPackage.resources.find((item) => item.path === "organizations.csv");

  assert.ok(resource, "organizations.csv must be a declared resource");
  assert.equal(resource.profile, "tabular-data-resource");
  assert.deepEqual(
    resource.schema.fields.map((field) => field.name),
    [
      "schema_version",
      "organization_id",
      "organization_name",
      "organization_short_name",
      "organization_kind",
      "explicit_lead_links",
      "explicit_collaborator_links",
      "other_named_party_links",
      "source_role_links",
      "directive_units_named_in",
      "record_path",
    ],
  );
});
