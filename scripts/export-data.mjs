import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isIsoDate } from "./iso-date.mjs";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const [
  sources,
  organizations,
  themes,
  directiveData,
  analysisData,
  evidenceData,
  watchlistData,
  feasibilityData,
  schema,
  watchlistSchema,
] =
  await Promise.all([
    readJson("data/sources.json"),
    readJson("data/organizations.json"),
    readJson("data/themes.json"),
    readJson("data/directives.json"),
    readJson("data/analysis.json"),
    readJson("data/evidence.json"),
    readJson("data/watchlist.json"),
    readJson("data/tda-ntd-feasibility.json"),
    readJson("data/public-schema.json"),
    readJson("data/watchlist-schema.json"),
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
    if (schemaNode.format === "date" && !isIsoDate(value)) {
      schemaFailure(path, "expected a real ISO calendar date");
    }
    return;
  }

  if (schemaNode.type === "boolean") {
    if (typeof value !== "boolean") schemaFailure(path, "expected boolean");
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
    return;
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
  .concat(evidenceData.evidence.map(({ lastReviewedOn }) => lastReviewedOn))
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
  evidenceScope: {
    scope: evidenceData.scope,
    lastUpdatedOn: evidenceData.lastUpdatedOn,
    nextReviewOn: evidenceData.nextReviewOn,
    reviewCommitment: evidenceData.reviewCommitment,
    coverageNote: evidenceData.coverageNote,
    reviewSources: evidenceData.reviewSources,
    sweeps: evidenceData.sweeps,
  },
  evidence: evidenceData.evidence,
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

const evidenceCsvColumns = [
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
];

const evidenceCsvRows = evidenceData.evidence.map((record) => [
  record.id,
  evidenceData.schemaVersion,
  evidenceData.scope,
  evidenceData.lastUpdatedOn,
  evidenceData.coverageNote,
  record.title,
  record.titleOrigin,
  record.publisher,
  record.evidenceType,
  record.datedOn,
  record.dateKind,
  record.dateOrigin,
  record.url,
  record.contextUrl,
  record.retrievedOn,
  record.lastReviewedOn,
  record.sha256,
  record.mediaType,
  record.pageCount,
  record.accessibility.tagged,
  record.accessibility.note,
  record.editorialSummary,
  record.directiveLinks.map(({ directiveId }) => directiveId),
  record.directiveLinks.map(({ relationship }) => relationship),
  record.directiveLinks
    .map(({ directiveId, excerpt }) => `${directiveId}: ${excerpt}`)
    .join(" || "),
  record.directiveLinks
    .map(
      ({ directiveId, locator }) =>
        `${directiveId}: pages ${locator.pages.join(", ")}; ${locator.locations.join(" | ")}`,
    )
    .join(" || "),
  record.limitations.join(" || "),
]);

const evidenceCsv = [
  evidenceCsvColumns.map(csvCell).join(","),
  ...evidenceCsvRows.map((row) => row.map(csvCell).join(",")),
].join("\n");

const watchlistCsvColumns = [
  "id",
  "schema_version",
  "scope",
  "collection_last_updated_on",
  "boundary_note",
  "kind",
  "title",
  "title_origin",
  "publisher",
  "url",
  "media_type",
  "related_urls",
  "source_date",
  "source_date_kind",
  "source_date_origin",
  "retrieved_on",
  "last_reviewed_on",
  "editorial_summary",
  "why_tracked",
  "evidence_boundary_reason",
  "evidence_boundary_checked_on",
  "explicit_order_citation",
  "evidence_boundary_note",
  "directive_ids",
  "relationships",
  "relevance_rationales",
  "next_review_on",
  "watch_for",
  "limitations",
];

const watchlistCsvRows = watchlistData.items.map((item) => [
  item.id,
  watchlistData.schemaVersion,
  watchlistData.scope,
  watchlistData.lastUpdatedOn,
  watchlistData.boundaryNote,
  item.kind,
  item.title,
  item.titleOrigin,
  item.publisher,
  item.url,
  item.mediaType,
  item.relatedUrls
    .map(({ label, url }) => `${label}: ${url}`)
    .join(" || "),
  item.sourceDate?.value ?? "",
  item.sourceDate?.kind ?? "",
  item.sourceDate?.origin ?? "",
  item.retrievedOn,
  item.lastReviewedOn,
  item.editorialSummary,
  item.whyTracked,
  item.evidenceBoundary.reason,
  item.evidenceBoundary.checkedOn,
  item.evidenceBoundary.explicitOrderCitation,
  item.evidenceBoundary.note,
  item.directiveLinks.map(({ directiveId }) => directiveId),
  item.directiveLinks.map(({ relationship }) => relationship),
  item.directiveLinks
    .map(
      ({ directiveId, rationale }) => `${directiveId}: ${rationale}`,
    )
    .join(" || "),
  item.nextReviewOn,
  item.watchFor.join(" || "),
  item.limitations.join(" || "),
]);

const watchlistCsv = [
  watchlistCsvColumns.map(csvCell).join(","),
  ...watchlistCsvRows.map((row) => row.map(csvCell).join(",")),
].join("\n");

const directiveOrganizationsCsvColumns = [
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
];

const sourceRoleGroups = [
  ["explicit-lead", "leadOrgIds"],
  ["explicit-collaborator", "collaboratorOrgIds"],
  ["other-named-party", "mentionedOrgIds"],
];

const directiveOrganizationsCsvRows = directives.flatMap((directive) =>
  sourceRoleGroups.flatMap(([sourceRole, field]) =>
    directive[field].map((organizationId) => {
      const organization = organizationById.get(organizationId);
      if (!organization) {
        throw new Error(
          `Cannot export unknown organization ${organizationId} for ${directive.id}.`,
        );
      }
      return [
        directiveData.schemaVersion,
        directive.id,
        directive.label,
        directive.title,
        organization.id,
        organization.name,
        organization.shortName,
        organization.kind,
        sourceRole,
        directive.sourceId,
        directive.sourceUrl,
        directive.lastReviewedOn,
      ];
    }),
  ),
);

const directiveOrganizationsCsv = [
  directiveOrganizationsCsvColumns.map(csvCell).join(","),
  ...directiveOrganizationsCsvRows.map((row) => row.map(csvCell).join(",")),
].join("\n");

const directiveRelationshipsCsvColumns = [
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
];

function hasReciprocalReference(recordDirectiveId, relatedDirectiveId) {
  const relatedAnalysis = analysisById.get(relatedDirectiveId);
  return Boolean(
    relatedAnalysis?.dependencies.some((dependency) =>
      dependency.relatedDirectiveIds.includes(recordDirectiveId),
    ),
  );
}

const directiveRelationshipsCsvRows = directives.flatMap((directive) =>
  directive.analysis.dependencies.flatMap((dependency) =>
    dependency.relatedDirectiveIds.map((relatedDirectiveId) => {
      const relatedDirective = directives.find(({ id }) => id === relatedDirectiveId);
      if (!relatedDirective) {
        throw new Error(
          `Cannot export unknown related directive ${relatedDirectiveId} for ${directive.id}.`,
        );
      }
      return [
        directiveData.schemaVersion,
        directive.id,
        directive.label,
        directive.title,
        relatedDirective.id,
        relatedDirective.label,
        relatedDirective.title,
        dependency.text,
        dependency.origin,
        dependency.confidence,
        hasReciprocalReference(directive.id, relatedDirective.id),
      ];
    }),
  ),
);

const directiveRelationshipsCsv = [
  directiveRelationshipsCsvColumns.map(csvCell).join(","),
  ...directiveRelationshipsCsvRows.map((row) => row.map(csvCell).join(",")),
].join("\n");

validateAgainstSchema(publicData, schema, schema);
validateAgainstSchema(
  watchlistData,
  watchlistSchema,
  watchlistSchema,
);

// Every export, as the exact bytes it should hold. Building the whole set before
// touching the disk is what makes `--check` possible: the comparison and the write
// are two things done with one answer, so they can never be computed differently.
const exports = new Map([
  ["directives.json", `${JSON.stringify(publicData, null, 2)}\n`],
  ["directives.csv", `${csv}\n`],
  ["evidence.csv", `${evidenceCsv}\n`],
  ["watchlist.json", `${JSON.stringify(watchlistData, null, 2)}\n`],
  ["watchlist.csv", `${watchlistCsv}\n`],
  ["watchlist-schema.json", `${JSON.stringify(watchlistSchema, null, 2)}\n`],
  ["directive-organizations.csv", `${directiveOrganizationsCsv}\n`],
  ["directive-relationships.csv", `${directiveRelationshipsCsv}\n`],
  ["schema.json", `${JSON.stringify(schema, null, 2)}\n`],
  ["tda-ntd-feasibility.json", `${JSON.stringify(feasibilityData, null, 2)}\n`],
]);

const outputDir = new URL("public/data/", root);

// `--check` writes nothing. It exists because the release gate used to run the
// writing path: `npm run check` calls `npm test`, which calls `npm run build`,
// which calls this script, so every local run of the documented gate regenerated
// ten tracked files into the working tree and then reported success. A stale
// committed export could not fail, because the thing that would have noticed had
// already overwritten it. Only `.github/workflows/quality.yml` caught it, and that
// workflow skips itself on a docs-only change and is not the workflow that
// deploys or releases.
//
// A missing file is reported here as well as a differing one. `git diff
// --exit-code` cannot see a file that is not tracked, so a new export added to
// the set above without being committed would have passed that check silently.
if (process.argv.includes("--check")) {
  const stale = [];
  for (const [name, expected] of exports) {
    const path = new URL(name, outputDir);
    let actual;
    try {
      actual = await readFile(path, "utf8");
    } catch {
      stale.push(`public/data/${name}: not committed`);
      continue;
    }
    if (actual !== expected) {
      stale.push(`public/data/${name}: differs from a fresh export`);
    }
  }
  if (stale.length > 0) {
    console.error("committed exports are not what the data produces:");
    for (const line of stale) {
      console.error(`  ${line}`);
    }
    console.error("run `npm run data:export` and commit the result");
    process.exit(1);
  }
  console.log(
    `Committed exports match a fresh export (${exports.size} files).`,
  );
  process.exit(0);
}

await mkdir(outputDir, { recursive: true });
await Promise.all(
  [...exports].map(([name, content]) =>
    writeFile(new URL(name, outputDir), content),
  ),
);

console.log(
  `Exported ${directives.length} directives, ${evidenceData.evidence.length} evidence record(s), ${watchlistData.items.length} context watchlist item(s), ${directiveOrganizationsCsvRows.length} source-role links, ${directiveRelationshipsCsvRows.length} analytical cross-references, and the four-field reporting slice.`,
);
