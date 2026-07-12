import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const [sources, organizations, themes, directiveData, analysisData, schema] =
  await Promise.all([
    readJson("data/sources.json"),
    readJson("data/organizations.json"),
    readJson("data/themes.json"),
    readJson("data/directives.json"),
    readJson("data/analysis.json"),
    readJson("data/public-schema.json"),
  ]);

const sourceById = new Map(sources.map((item) => [item.id, item]));
const organizationById = new Map(organizations.map((item) => [item.id, item]));
const themeById = new Map(themes.map((item) => [item.id, item]));
const analysisById = new Map(
  analysisData.analysis.map((item) => [item.directiveId, item]),
);

function schemaFailure(path, message) {
  throw new Error(`Public export schema validation failed at ${path}: ${message}`);
}

function resolveReference(rootSchema, reference) {
  if (!reference.startsWith("#/")) {
    throw new Error(`Unsupported JSON Schema reference: ${reference}`);
  }
  return reference
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((node, part) => node?.[part], rootSchema);
}

function validateAgainstSchema(value, schemaNode, rootSchema, path = "$") {
  if (schemaNode.$ref) {
    const resolved = resolveReference(rootSchema, schemaNode.$ref);
    if (!resolved) throw new Error(`Unresolved JSON Schema reference: ${schemaNode.$ref}`);
    validateAgainstSchema(value, resolved, rootSchema, path);
    return;
  }

  if (Object.hasOwn(schemaNode, "const") && value !== schemaNode.const) {
    schemaFailure(path, `expected constant ${JSON.stringify(schemaNode.const)}`);
  }
  if (schemaNode.enum && !schemaNode.enum.includes(value)) {
    schemaFailure(path, `expected one of ${schemaNode.enum.join(", ")}`);
  }

  if (schemaNode.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      schemaFailure(path, "expected object");
    }
    for (const required of schemaNode.required ?? []) {
      if (!Object.hasOwn(value, required)) schemaFailure(path, `missing required property ${required}`);
    }
    for (const [key, child] of Object.entries(value)) {
      const childSchema = schemaNode.properties?.[key];
      if (!childSchema) {
        if (schemaNode.additionalProperties === false) {
          schemaFailure(`${path}.${key}`, "additional property is not allowed");
        }
        continue;
      }
      validateAgainstSchema(child, childSchema, rootSchema, `${path}.${key}`);
    }
    return;
  }

  if (schemaNode.type === "array") {
    if (!Array.isArray(value)) schemaFailure(path, "expected array");
    if (schemaNode.minItems !== undefined && value.length < schemaNode.minItems) {
      schemaFailure(path, `expected at least ${schemaNode.minItems} items`);
    }
    if (schemaNode.maxItems !== undefined && value.length > schemaNode.maxItems) {
      schemaFailure(path, `expected no more than ${schemaNode.maxItems} items`);
    }
    if (schemaNode.items) {
      value.forEach((item, index) =>
        validateAgainstSchema(item, schemaNode.items, rootSchema, `${path}[${index}]`),
      );
    }
    return;
  }

  if (schemaNode.type === "string") {
    if (typeof value !== "string") schemaFailure(path, "expected string");
    if (schemaNode.minLength !== undefined && value.length < schemaNode.minLength) {
      schemaFailure(path, `expected at least ${schemaNode.minLength} characters`);
    }
    if (schemaNode.pattern && !new RegExp(schemaNode.pattern).test(value)) {
      schemaFailure(path, `does not match ${schemaNode.pattern}`);
    }
    if (schemaNode.format === "uri") {
      try {
        new URL(value);
      } catch {
        schemaFailure(path, "expected a valid URI");
      }
    }
    return;
  }

  if (schemaNode.type === "integer") {
    if (!Number.isInteger(value)) schemaFailure(path, "expected integer");
    if (schemaNode.minimum !== undefined && value < schemaNode.minimum) {
      schemaFailure(path, `expected a value of at least ${schemaNode.minimum}`);
    }
    if (schemaNode.maximum !== undefined && value > schemaNode.maximum) {
      schemaFailure(path, `expected a value no greater than ${schemaNode.maximum}`);
    }
  }
}

const directives = directiveData.directives.map((directive) => {
  const analysis = analysisById.get(directive.id);
  const source = sourceById.get(directive.sourceId);
  return {
    ...directive,
    sourceUrl: source.url,
    leadOrganizations: directive.leadOrgIds.map(
      (id) => organizationById.get(id).name,
    ),
    collaboratorOrganizations: directive.collaboratorOrgIds.map(
      (id) => organizationById.get(id).name,
    ),
    mentionedOrganizations: directive.mentionedOrgIds.map(
      (id) => organizationById.get(id).name,
    ),
    analysis: {
      ...analysis,
      themes: analysis.themeIds.map((id) => themeById.get(id).name),
    },
  };
});

const dataReviewedThrough = directiveData.directives
  .map(({ lastReviewedOn }) => lastReviewedOn)
  .sort()
  .at(-1);

const publicData = {
  project: "Transit Delivery Atlas",
  schemaVersion: directiveData.schemaVersion,
  dataReviewedThrough,
  source: sources[0],
  orderMetadata: directiveData.orderMetadata,
  organizations,
  themes,
  directives,
};

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

const csvColumns = [
  "id",
  "schema_version",
  "source_id",
  "section",
  "title",
  "title_origin",
  "analysis_summary",
  "lead_organizations",
  "collaborator_organizations",
  "mentioned_organizations",
  "analysis_themes",
  "source_context_ids",
  "qualifiers",
  "source_notes",
  "timing_source_text",
  "calculated_planning_dates",
  "source_pages",
  "source_url",
  "last_reviewed_on",
];

const csvRows = directives.map((directive) => [
  directive.id,
  directiveData.schemaVersion,
  directive.sourceId,
  directive.label,
  directive.title,
  directive.titleOrigin,
  directive.analysis.summary,
  directive.leadOrganizations,
  directive.collaboratorOrganizations,
  directive.mentionedOrganizations,
  directive.analysis.themes,
  directive.sourceContextIds,
  directive.qualifiers.map(
    ({ text, appliesTo }) => `${text} [applies to: ${appliesTo}]`,
  ),
  directive.sourceNotes.map(({ text }) => text),
  directive.timing.map(({ sourceText }) => sourceText),
  directive.timing.map(({ derivedDate }) => derivedDate),
  directive.locator.pages,
  directive.sourceUrl,
  directive.lastReviewedOn,
]);

const csv = [
  csvColumns.map(csvCell).join(","),
  ...csvRows.map((row) => row.map(csvCell).join(",")),
].join("\n");

validateAgainstSchema(publicData, schema, schema);

const outputDir = new URL("public/data/", root);
await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(
    new URL("directives.json", outputDir),
    `${JSON.stringify(publicData, null, 2)}\n`,
  ),
  writeFile(new URL("directives.csv", outputDir), `${csv}\n`),
  writeFile(
    new URL("schema.json", outputDir),
    `${JSON.stringify(schema, null, 2)}\n`,
  ),
]);

console.log(`Exported ${directives.length} directives to JSON and CSV.`);
