import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  filterDependencyRoutes,
  filterNamedBodies,
} from "../lib/relationship-filters.ts";
import { isIsoDate } from "../scripts/iso-date.mjs";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function parseCsv(text) {
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const cells = [];
      let cell = "";
      let quoted = false;

      for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
          if (quoted && line[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            quoted = !quoted;
          }
        } else if (character === "," && !quoted) {
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

function assertIsoDate(value, label) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, label);
  assert.equal(
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10),
    value,
    label,
  );
}

function statusLikeKeys(value, path = "$") {
  if (!value || typeof value !== "object") return [];
  const forbiddenKeys = new Set([
    "status",
    "progress",
    "percentcomplete",
    "compliance",
    "rating",
    "score",
    "ontrack",
  ]);
  return Object.entries(value).flatMap(([key, child]) => [
    ...(forbiddenKeys.has(key.toLowerCase()) ? [`${path}.${key}`] : []),
    ...statusLikeKeys(child, `${path}.${key}`),
  ]);
}

test("ISO date validation rejects impossible calendar dates", () => {
  assert.equal(isIsoDate("2026-07-13"), true);
  assert.equal(isIsoDate("2026-02-29"), false);
  assert.equal(isIsoDate("2026-02-31"), false);
  assert.equal(isIsoDate("2026-99-99"), false);
  assert.equal(isIsoDate("07/13/2026"), false);
});

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

test("implementation evidence is selectively scoped with exact Order 5 provenance", async () => {
  const evidenceData = await readJson("data/evidence.json");

  assert.equal(evidenceData.schemaVersion, "0.2.0");
  assert.equal(evidenceData.scope, "selective");
  assertIsoDate(evidenceData.lastUpdatedOn, "evidence collection lastUpdatedOn");
  assert.equal(
    evidenceData.lastUpdatedOn,
    evidenceData.evidence.map(({ lastReviewedOn }) => lastReviewedOn).sort().at(-1),
  );
  assert.match(evidenceData.coverageNote, /not comprehensive/i);
  assert.match(evidenceData.coverageNote, /not evidence/i);

  const record = evidenceData.evidence.find(
    ({ id }) => id === "ctc-2026-07-15-order-5-reference-material",
  );
  assert.ok(record);
  assert.equal(
    record.title,
    "Transit Executive Order N-7-26 Resource Material (7/15/2026)",
  );
  assert.equal(record.titleOrigin, "publisher");
  assert.equal(record.publisher, "California Transportation Commission");
  assert.equal(record.evidenceType, "reference-material");
  assert.equal(record.datedOn, "2026-07-15");
  assert.equal(record.dateKind, "scheduled-event");
  assert.equal(record.dateOrigin, "artifact-header");
  assert.equal(
    record.url,
    "https://catc.ca.gov/-/media/ctc-media/documents/programs/senate-bill-1/july-15-sccp-and-lpp-c-workshop-transit-eo-resource-material-002-a11y.pdf",
  );
  assert.equal(
    record.sha256,
    "e67d692cc3e780e8140a5414e6448619a7d9a7db0471069ab768686c7ecd04a4",
  );
  assert.deepEqual(
    record.directiveLinks.map(({ directiveId }) => directiveId),
    ["n-7-26-5"],
  );
  assert.deepEqual(record.directiveLinks[0], {
    directiveId: "n-7-26-5",
    relationship: "explicit-citation",
    excerpt: "Pursuant to Executive Order N-7-26 (Order #5)",
    locator: {
      pages: [1, 2],
      locations: [
        "Page 1: Reference Instructions and SCCP Part IV, Section 17.2.2",
        "Page 2: Reference Instructions; LPP-C Part II, Section 6B; and Part IV, Section 14.1",
      ],
    },
  });
  assert.match(record.limitations.join(" "), /proposed SCCP and LPP-C changes/i);
  assert.match(record.limitations.join(" "), /does not establish adoption, completion, compliance/i);

  const presentation = evidenceData.evidence.find(
    ({ id }) => id === "ctc-2026-07-15-order-5-workshop-presentation",
  );
  assert.ok(presentation);
  assert.equal(presentation.publisher, "California Transportation Commission");
  assert.equal(presentation.evidenceType, "meeting-material");
  assert.equal(presentation.datedOn, "2026-07-15");
  assert.equal(presentation.dateKind, "published");
  assert.equal(
    presentation.sha256,
    "0ef1bc99da045d7b34feddbe0573ca2dfa3951b34bcee394da91aca69cc7dcf5",
  );
  assert.equal(presentation.pageCount, 20);
  assert.deepEqual(
    presentation.directiveLinks.map(({ directiveId }) => directiveId),
    ["n-7-26-5"],
  );
  assert.deepEqual(presentation.directiveLinks[0].locator.pages, [12, 13, 14, 15]);
  assert.match(presentation.editorialSummary, /not currently open/i);
  assert.match(presentation.limitations.join(" "), /not a final guideline/i);
});

test("evidence records retain secure URLs, hashes, dates, and bounded locators", async () => {
  const [evidenceData, directiveData] = await Promise.all([
    readJson("data/evidence.json"),
    readJson("data/directives.json"),
  ]);
  const directiveIds = new Set(directiveData.directives.map(({ id }) => id));

  for (const record of evidenceData.evidence) {
    assert.equal(new URL(record.url).protocol, "https:", `${record.id} artifact URL`);
    assert.equal(new URL(record.contextUrl).protocol, "https:", `${record.id} context URL`);
    assert.match(record.sha256, /^[a-f0-9]{64}$/, `${record.id} SHA-256`);
    for (const field of ["datedOn", "retrievedOn", "lastReviewedOn"]) {
      assertIsoDate(record[field], `${record.id}.${field}`);
    }
    assert.ok(record.lastReviewedOn >= record.retrievedOn, record.id);
    assert.ok(Number.isInteger(record.pageCount) && record.pageCount > 0, record.id);

    for (const link of record.directiveLinks) {
      assert.ok(directiveIds.has(link.directiveId), `${record.id}: ${link.directiveId}`);
      assert.equal(link.relationship, "explicit-citation");
      assert.ok(link.excerpt.length >= 10, record.id);
      assert.ok(link.locator.pages.length > 0, record.id);
      assert.ok(
        link.locator.pages.every(
          (page) => Number.isInteger(page) && page > 0 && page <= record.pageCount,
        ),
        record.id,
      );
      assert.ok(
        link.locator.locations.every((location) => location.length >= 10),
        record.id,
      );
    }
  }
});

test("evidence data recursively forbids implementation-status-like keys", async () => {
  const [canonical, exported] = await Promise.all([
    readJson("data/evidence.json"),
    readJson("public/data/directives.json"),
  ]);

  assert.deepEqual(statusLikeKeys(canonical), []);
  assert.deepEqual(
    statusLikeKeys({ evidenceScope: exported.evidenceScope, evidence: exported.evidence }),
    [],
  );
});

test("public JSON, JSON Schema, and evidence CSV expose one consistent evidence collection", async () => {
  const [canonical, exported, sourceSchema, exportedSchema, evidenceCsv] =
    await Promise.all([
      readJson("data/evidence.json"),
      readJson("public/data/directives.json"),
      readJson("data/public-schema.json"),
      readJson("public/data/schema.json"),
      readFile(new URL("public/data/evidence.csv", root), "utf8"),
    ]);

  assert.deepEqual(exportedSchema, sourceSchema);
  assert.equal(exported.schemaVersion, canonical.schemaVersion);
  assert.equal(
    exported.dataReviewedThrough,
    [
      ...exported.directives.map(({ lastReviewedOn }) => lastReviewedOn),
      ...canonical.evidence.map(({ lastReviewedOn }) => lastReviewedOn),
    ]
      .sort()
      .at(-1),
  );
  assert.deepEqual(exported.evidenceScope, {
    scope: canonical.scope,
    lastUpdatedOn: canonical.lastUpdatedOn,
    coverageNote: canonical.coverageNote,
  });
  assert.deepEqual(exported.evidence, canonical.evidence);
  assert.ok(exported.directives.every((directive) => !Object.hasOwn(directive, "evidence")));

  const [header, ...rows] = parseCsv(evidenceCsv);
  assert.deepEqual(header, [
    "id",
    "schema_version",
    "scope",
    "collection_last_updated_on",
    "coverage_note",
    "title",
    "title_origin",
    "publisher",
    "evidence_type",
    "dated_on",
    "date_kind",
    "date_origin",
    "url",
    "context_url",
    "retrieved_on",
    "last_reviewed_on",
    "sha256",
    "media_type",
    "page_count",
    "tagged",
    "accessibility_note",
    "editorial_summary",
    "directive_ids",
    "relationships",
    "relationship_excerpts",
    "relationship_locators",
    "limitations",
  ]);
  assert.equal(rows.length, canonical.evidence.length);

  const csvById = new Map(rows.map((row) => [row[header.indexOf("id")], row]));
  for (const record of canonical.evidence) {
    const row = csvById.get(record.id);
    assert.ok(row, record.id);
    const value = (column) => row[header.indexOf(column)];
    assert.equal(value("schema_version"), canonical.schemaVersion);
    assert.equal(value("scope"), canonical.scope);
    assert.equal(value("collection_last_updated_on"), canonical.lastUpdatedOn);
    assert.equal(value("coverage_note"), canonical.coverageNote);
    assert.equal(value("title"), record.title);
    assert.equal(value("title_origin"), record.titleOrigin);
    assert.equal(value("publisher"), record.publisher);
    assert.equal(value("evidence_type"), record.evidenceType);
    assert.equal(value("dated_on"), record.datedOn);
    assert.equal(value("date_kind"), record.dateKind);
    assert.equal(value("date_origin"), record.dateOrigin);
    assert.equal(value("url"), record.url);
    assert.equal(value("context_url"), record.contextUrl);
    assert.equal(value("retrieved_on"), record.retrievedOn);
    assert.equal(value("last_reviewed_on"), record.lastReviewedOn);
    assert.equal(value("sha256"), record.sha256);
    assert.equal(value("media_type"), record.mediaType);
    assert.equal(value("page_count"), String(record.pageCount));
    assert.equal(value("tagged"), String(record.accessibility.tagged));
    assert.equal(value("accessibility_note"), record.accessibility.note);
    assert.equal(value("editorial_summary"), record.editorialSummary);
    assert.equal(
      value("directive_ids"),
      record.directiveLinks.map(({ directiveId }) => directiveId).join(" | "),
    );
    assert.equal(
      value("relationships"),
      record.directiveLinks.map(({ relationship }) => relationship).join(" | "),
    );
    assert.equal(
      value("relationship_excerpts"),
      record.directiveLinks
        .map(({ directiveId, excerpt }) => `${directiveId}: ${excerpt}`)
        .join(" || "),
    );
    assert.equal(
      value("relationship_locators"),
      record.directiveLinks
        .map(
          ({ directiveId, locator }) =>
            `${directiveId}: pages ${locator.pages.join(", ")}; ${locator.locations.join(" | ")}`,
        )
        .join(" || "),
    );
    assert.equal(value("limitations"), record.limitations.join(" || "));
  }
});

test("normalized body-role export matches all 50 canonical source relationships", async () => {
  const [directiveData, organizations, sources, csvText] = await Promise.all([
    readJson("data/directives.json"),
    readJson("data/organizations.json"),
    readJson("data/sources.json"),
    readFile(new URL("public/data/directive-organizations.csv", root), "utf8"),
  ]);
  const organizationById = new Map(organizations.map((item) => [item.id, item]));
  const sourceById = new Map(sources.map((item) => [item.id, item]));
  const roleFields = [
    ["explicit-lead", "leadOrgIds"],
    ["explicit-collaborator", "collaboratorOrgIds"],
    ["other-named-party", "mentionedOrgIds"],
  ];
  const expected = directiveData.directives.flatMap((directive) =>
    roleFields.flatMap(([role, field]) =>
      directive[field].map((organizationId) => ({
        schema_version: directiveData.schemaVersion,
        directive_id: directive.id,
        section: directive.label,
        directive_title: directive.title,
        organization_id: organizationId,
        organization_name: organizationById.get(organizationId).name,
        organization_short_name: organizationById.get(organizationId).shortName,
        organization_kind: organizationById.get(organizationId).kind,
        source_role: role,
        source_id: directive.sourceId,
        source_url: sourceById.get(directive.sourceId).url,
        last_reviewed_on: directive.lastReviewedOn,
      })),
    ),
  );

  assert.equal(expected.length, 50);
  assert.equal(new Set(expected.map(({ organization_id }) => organization_id)).size, 23);

  const [header, ...rows] = parseCsv(csvText);
  assert.deepEqual(header, [
    "schema_version",
    "directive_id",
    "section",
    "directive_title",
    "organization_id",
    "organization_name",
    "organization_short_name",
    "organization_kind",
    "source_role",
    "source_id",
    "source_url",
    "last_reviewed_on",
  ]);
  assert.equal(rows.length, expected.length);

  const actual = rows.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index]])),
  );
  for (const [index, expectedRow] of expected.entries()) {
    for (const [column, value] of Object.entries(expectedRow)) {
      assert.equal(actual[index][column], value, `${index}.${column}`);
    }
  }
});

test("normalized analytical relationships preserve 27 cross-references without workflow direction", async () => {
  const [directiveData, analysisData, csvText] = await Promise.all([
    readJson("data/directives.json"),
    readJson("data/analysis.json"),
    readFile(new URL("public/data/directive-relationships.csv", root), "utf8"),
  ]);
  const directiveById = new Map(
    directiveData.directives.map((directive) => [directive.id, directive]),
  );
  const referenceKeys = new Set(
    analysisData.analysis.flatMap((record) =>
      record.dependencies.flatMap((dependency) =>
        dependency.relatedDirectiveIds.map(
          (relatedDirectiveId) => `${record.directiveId}->${relatedDirectiveId}`,
        ),
      ),
    ),
  );
  const expected = analysisData.analysis.flatMap((record) =>
    record.dependencies.flatMap((dependency) =>
      dependency.relatedDirectiveIds.map((relatedDirectiveId) => {
        assert.notEqual(relatedDirectiveId, record.directiveId);
        return {
          schema_version: analysisData.schemaVersion,
          record_directive_id: record.directiveId,
          record_section: directiveById.get(record.directiveId).label,
          record_title: directiveById.get(record.directiveId).title,
          related_directive_id: relatedDirectiveId,
          related_section: directiveById.get(relatedDirectiveId).label,
          related_title: directiveById.get(relatedDirectiveId).title,
          dependency_text: dependency.text,
          origin: dependency.origin,
          confidence: dependency.confidence,
          reciprocal_reference: String(
            referenceKeys.has(`${relatedDirectiveId}->${record.directiveId}`),
          ),
        };
      }),
    ),
  );

  assert.equal(analysisData.analysis.flatMap(({ dependencies }) => dependencies).length, 21);
  assert.equal(expected.length, 27);
  assert.equal(
    new Set(
      expected.map(({ record_directive_id, related_directive_id }) =>
        [record_directive_id, related_directive_id].sort().join("<->"),
      ),
    ).size,
    15,
  );
  assert.equal(
    expected.filter(({ reciprocal_reference }) => reciprocal_reference === "true").length,
    24,
  );

  const [header, ...rows] = parseCsv(csvText);
  assert.deepEqual(header, [
    "schema_version",
    "record_directive_id",
    "record_section",
    "record_title",
    "related_directive_id",
    "related_section",
    "related_title",
    "dependency_text",
    "origin",
    "confidence",
    "reciprocal_reference",
  ]);
  assert.equal(rows.length, expected.length);
  const actual = rows.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index]])),
  );
  assert.deepEqual(actual, expected);
});

test("handoff filters cover source roles, body types, themes, confidence, and empty links", async () => {
  const dataset = await readJson("public/data/directives.json");
  const roleFields = [
    ["lead", "leadOrgIds"],
    ["collaborator", "collaboratorOrgIds"],
    ["mentioned", "mentionedOrgIds"],
  ];
  const bodies = dataset.organizations
    .map((organization) => ({
      ...organization,
      kindLabel: organization.kind.replaceAll("-", " "),
      occurrences: dataset.directives.flatMap((directive) =>
        roleFields.flatMap(([role, field]) =>
          directive[field].includes(organization.id)
            ? [{ label: directive.label, title: directive.title, role }]
            : [],
        ),
      ),
    }))
    .filter(({ occurrences }) => occurrences.length > 0);
  const directivesById = new Map(
    dataset.directives.map((directive) => [directive.id, directive]),
  );
  const routes = dataset.directives.flatMap((directive) =>
    directive.analysis.dependencies.map((dependency) => ({
      directive,
      text: dependency.text,
      confidence: dependency.confidence,
      themes: directive.analysis.themeIds.map((themeId) => ({
        id: themeId,
        name: dataset.themes.find(({ id }) => id === themeId).name,
      })),
      relatedDirectives: dependency.relatedDirectiveIds.map((id) =>
        directivesById.get(id),
      ),
    })),
  );

  const emptyOrganizationFilters = { query: "", kind: "", role: "" };
  assert.equal(filterNamedBodies(bodies, emptyOrganizationFilters).length, 23);
  assert.deepEqual(
    filterNamedBodies(bodies, { ...emptyOrganizationFilters, role: "lead" }).map(
      ({ id }) => id,
    ),
    ["caltrans", "calsta"],
  );
  assert.equal(
    filterNamedBodies(bodies, {
      ...emptyOrganizationFilters,
      kind: "federal-agency",
    }).length,
    4,
  );
  assert.deepEqual(
    filterNamedBodies(bodies, { ...emptyOrganizationFilters, query: "CTC" }).map(
      ({ id }) => id,
    ),
    ["ctc"],
  );

  const emptyDependencyFilters = {
    query: "",
    theme: "",
    confidence: "",
    connection: "",
  };
  assert.equal(filterDependencyRoutes(routes, emptyDependencyFilters).length, 21);
  assert.equal(
    filterDependencyRoutes(routes, {
      ...emptyDependencyFilters,
      connection: "unlinked",
    }).length,
    4,
  );
  assert.equal(
    filterDependencyRoutes(routes, {
      ...emptyDependencyFilters,
      theme: "data-shared-systems",
    }).length,
    5,
  );
  assert.equal(
    filterDependencyRoutes(routes, {
      ...emptyDependencyFilters,
      confidence: "high",
    }).length,
    10,
  );
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

test("the public four-field reporting slice matches its reviewed source", async () => {
  const [canonical, published] = await Promise.all([
    readJson("data/tda-ntd-feasibility.json"),
    readJson("public/data/tda-ntd-feasibility.json"),
  ]);

  assert.deepEqual(published, canonical);
  assert.equal(published.directiveId, "n-7-26-3b");
  assert.deepEqual(
    published.fields.map(({ id, classification }) => [id, classification]),
    [
      ["unlinked-passenger-trips", "assistable-human-method-review"],
      ["vehicle-revenue-miles", "conditionally-automatable"],
      ["vehicle-revenue-hours", "conditionally-automatable"],
      ["total-operating-expense", "reconciliation-required"],
    ],
  );
  assert.deepEqual(
    published.reportingPaths.map(({ id }) => id),
    ["urban-reduced-direct", "california-rural-5311"],
  );
  assert.ok(
    published.sources.every(({ url }) =>
      /^https:\/\/(?:www\.)?(?:sco\.ca\.gov|leginfo\.legislature\.ca\.gov|transit\.dot\.gov|dot\.ca\.gov)\//.test(
        url,
      ),
    ),
  );
  assert.doesNotMatch(JSON.stringify(published), /"status"\s*:/i);
});

test("public schema is controlled and closes every typed object", async () => {
  const schema = await readJson("data/public-schema.json");
  assert.equal(schema.$id, "urn:transit-delivery-atlas:data-schema:0.2.0");
  assert.equal(schema.$defs.date.format, "date");
  assert.ok(schema.required.includes("evidenceScope"));
  assert.ok(schema.required.includes("evidence"));
  assert.equal(schema.properties.schemaVersion.const, "0.2.0");
  assert.ok(schema.properties.evidenceScope);
  assert.ok(schema.properties.evidence.items);

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
