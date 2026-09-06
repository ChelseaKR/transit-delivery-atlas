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

// The separator a multi-valued cell uses. Declared once because the Table Schema
// generated below has to say so, and a schema that named a different separator than
// the writer used would be worse than no schema at all.
const MULTI_VALUE_SEPARATOR = " | ";

function cellText(value) {
  return Array.isArray(value) ? value.join(MULTI_VALUE_SEPARATOR) : String(value ?? "");
}

function csvCell(value) {
  return `"${cellText(value).replaceAll('"', '""')}"`;
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

// --- Frictionless Data Package and DCAT record ----------------------------------
//
// The exports are the machine-readable product, and their contract lived in prose plus
// one JSON Schema. A data package makes the CSV columns typed and the licence and
// provenance travel with the files, so a consumer loading them with `frictionless` or
// `pandas` reads the same rules a reader of the site does.
//
// Every field in every Table Schema is DERIVED from the rows actually written, never
// authored beside them. A hand-maintained schema is a second copy of the truth, and a
// second copy drifts: this repository has already published one figure that described an
// older build than the one printed next to it. Types, required-ness and the multi-value
// note are read off the same values `csvCell` renders, so a column that changes shape
// changes its schema in the same commit, and `--check` fails a committed package that no
// longer describes the committed CSV.
//
// Two things are deliberately NOT in here.
//
// The build commit is not, even though it identifies the build: `datapackage.json` is
// compared byte-for-byte against a fresh export, so embedding a value that changes with
// every commit would make the gate fail on every pull request and teach everyone to
// regenerate it without reading it. The build commit is already published, per build,
// in `/version.json`, and the package points at it. `dataReviewedThrough` — a real
// review date, derived from the records — is what dates the data itself.
//
// A single SPDX licence identifier is not, because the licence genuinely is split. The
// analytical fields are CC BY 4.0; the signed order's excerpts, agency names and
// government publications are not relicensed by this project. Naming only CC BY 4.0 at
// the top would be a claim this project is not entitled to make about the source layer.

const SITE_ORIGIN = "https://transit.chelseakr.com";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INTEGER_PATTERN = /^-?\d+$/;

function tableField(name, values, anyArrayValued) {
  const texts = values.map(cellText);
  const present = texts.filter((text) => text !== "");
  const field = { name, type: "string" };

  if (present.length > 0 && !anyArrayValued) {
    if (present.every((text) => DATE_PATTERN.test(text))) {
      field.type = "date";
      field.format = "%Y-%m-%d";
    } else if (present.every((text) => INTEGER_PATTERN.test(text))) {
      field.type = "integer";
    } else if (present.every((text) => text === "true" || text === "false")) {
      field.type = "boolean";
    }
  }
  if (anyArrayValued) {
    field.description = `Multiple values are separated by "${MULTI_VALUE_SEPARATOR}".`;
  }
  // Required is asserted only when every row in the committed export carries a value.
  // An empty cell is an absent value, and the schema says absent rather than inventing
  // a default a reader would take for data.
  field.constraints = { required: present.length === texts.length };
  return field;
}

function tableSchema(columns, rows) {
  return {
    fields: columns.map((name, index) => {
      const values = rows.map((row) => row[index]);
      return tableField(name, values, values.some(Array.isArray));
    }),
    missingValues: [""],
  };
}

const CSV_DIALECT = {
  delimiter: ",",
  lineTerminator: "\n",
  quoteChar: '"',
  doubleQuote: true,
  header: true,
  // Every cell this exporter writes is quoted, including the header.
  caseSensitiveHeader: true,
};

const tabularResources = [
  {
    name: "directives",
    file: "directives.csv",
    title: "Signed directive units",
    description:
      "One row per signed directive unit in the source instrument, with its section " +
      "locator, the organizations it names by source role, its timing phrases and the " +
      "planning dates calculated from them, and the separately stored analytical summary " +
      "and themes. Source and analysis columns are distinguished by name; they are not " +
      "interchangeable.",
    columns: csvColumns,
    rows: csvRows,
  },
  {
    name: "evidence",
    file: "evidence.csv",
    title: "Reviewed public artifacts",
    description:
      "One row per reviewed public artifact in the selective evidence collection, with " +
      "its publisher, dates and date kinds, retrieval date, content hash, the directives " +
      "it is linked to, and the stated limitations of that link. Coverage is selective by " +
      "design; the scope and coverage-note columns carry that statement on every row.",
    columns: evidenceCsvColumns,
    rows: evidenceCsvRows,
  },
  {
    name: "watchlist",
    file: "watchlist.csv",
    title: "Context watchlist",
    description:
      "One row per non-evidentiary research lead. These records are deliberately outside " +
      "the evidence layer: the evidence-boundary columns record why each one is not " +
      "evidence and when that judgement was last checked.",
    columns: watchlistCsvColumns,
    rows: watchlistCsvRows,
  },
  {
    name: "directive-organizations",
    file: "directive-organizations.csv",
    title: "Directive-to-organization links, by source role",
    description:
      "One row per (directive, organization) pair, labelled with the source role the " +
      "signed text gives it: explicit lead, explicit collaborator, or other named party. " +
      "These are roles the instrument states, not an assignment of responsibility by this " +
      "project.",
    columns: directiveOrganizationsCsvColumns,
    rows: directiveOrganizationsCsvRows,
  },
  {
    name: "directive-relationships",
    file: "directive-relationships.csv",
    title: "Analytical cross-references between directives",
    description:
      "One row per analytical cross-reference. These are analysis, not source: the origin " +
      "and confidence columns say so on every row, and a cross-reference identifies a " +
      "question rather than a directional handoff.",
    columns: directiveRelationshipsCsvColumns,
    rows: directiveRelationshipsCsvRows,
  },
];

const jsonResources = [
  {
    name: "directives-json",
    path: "directives.json",
    title: "Structured public dataset",
    description:
      "The nested dataset the site is built from: source record, organizations, themes, " +
      "directive units with their analysis, the evidence scope, and the evidence records.",
    schemaPath: "schema.json",
  },
  {
    name: "watchlist-json",
    path: "watchlist.json",
    title: "Context watchlist",
    description: "The nested context-watchlist dataset, with its scope and review dates.",
    schemaPath: "watchlist-schema.json",
  },
  {
    name: "public-schema",
    path: "schema.json",
    title: "JSON Schema for the structured public dataset",
    description: "The committed JSON Schema `directives.json` is validated against at build.",
  },
  {
    name: "watchlist-schema",
    path: "watchlist-schema.json",
    title: "JSON Schema for the context watchlist",
    description: "The committed JSON Schema `watchlist.json` is validated against at build.",
  },
  {
    name: "tda-ntd-feasibility",
    path: "tda-ntd-feasibility.json",
    title: "TDA/NTD reporting-slice feasibility record",
    description:
      "The four-field reporting slice and the recorded feasibility assessment behind it.",
  },
];

const sourceProvenance = sources.map((item) => ({
  title: item.title,
  path: item.url,
  publisher: item.publisher,
  sourceId: item.id,
  issuedOn: item.issuedOn,
  retrievedOn: item.retrievedOn,
  sha256: item.sha256,
}));

const dataPackage = {
  $schema: "https://datapackage.org/profiles/1.0/datapackage.json",
  profile: "tabular-data-package",
  name: "transit-delivery-atlas",
  title: "Transit Delivery Atlas",
  description:
    "An independent, unofficial crosswalk of a signed California transit executive order: " +
    "its directive units, the organizations it names, the public artifacts reviewed " +
    "against them, and a separately labelled analytical layer. Source, evidence, analysis " +
    "and context are separate layers and never blur; every column name says which layer " +
    "it belongs to.",
  homepage: `${SITE_ORIGIN}/data`,
  version: directiveData.schemaVersion,
  created: dataReviewedThrough,
  keywords: [
    "california",
    "transit",
    "executive order",
    "public transportation",
    "government accountability",
  ],
  licenses: [
    {
      name: "CC-BY-4.0",
      path: "https://creativecommons.org/licenses/by/4.0/legalcode",
      title: "Creative Commons Attribution 4.0 International",
    },
  ],
  licenseNotes:
    "CC BY 4.0 covers this project's original analytical content and the analytical " +
    "columns derived from it. Source excerpts, government publications, agency names and " +
    "other third-party material are NOT relicensed by this notice and remain under their " +
    "own terms. See CONTENT-LICENSE.md.",
  buildCommit: `${SITE_ORIGIN}/version.json`,
  dataReviewedThrough,
  sources: sourceProvenance,
  resources: [
    ...tabularResources.map((resource) => ({
      name: resource.name,
      path: resource.file,
      title: resource.title,
      description: resource.description,
      profile: "tabular-data-resource",
      format: "csv",
      mediatype: "text/csv",
      encoding: "utf-8",
      dialect: CSV_DIALECT,
      schema: tableSchema(resource.columns, resource.rows),
    })),
    ...jsonResources.map((resource) => ({
      name: resource.name,
      path: resource.path,
      title: resource.title,
      description: resource.description,
      profile: "data-resource",
      format: "json",
      mediatype: "application/json",
      encoding: "utf-8",
      ...(resource.schemaPath ? { schemaPath: resource.schemaPath } : {}),
    })),
  ],
};

const dcatRecord = {
  "@context": {
    dcat: "http://www.w3.org/ns/dcat#",
    dct: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
    spdx: "http://spdx.org/rdf/terms#",
  },
  "@id": `${SITE_ORIGIN}/data`,
  "@type": "dcat:Dataset",
  "dct:identifier": "transit-delivery-atlas",
  "dct:title": dataPackage.title,
  "dct:description": dataPackage.description,
  "dct:publisher": {
    "@type": "foaf:Agent",
    "foaf:name": "Transit Delivery Atlas contributors",
  },
  // Both dates are review dates read off the records, not the moment of the build. A
  // build timestamp here would say the data changed whenever the site was rebuilt.
  "dct:issued": sources[0].retrievedOn,
  "dct:modified": dataReviewedThrough,
  "dct:license": "https://creativecommons.org/licenses/by/4.0/legalcode",
  "dct:rights": dataPackage.licenseNotes,
  "dct:accrualPeriodicity": evidenceData.reviewCommitment,
  "dct:source": sourceProvenance.map((item) => ({
    "@type": "dcat:Dataset",
    "dct:title": item.title,
    "dcat:accessURL": item.path,
    "dct:publisher": item.publisher,
    "dct:issued": item.issuedOn,
    "dcat:downloadURL": item.path,
    "spdx:checksum": { "@type": "spdx:Checksum", "spdx:algorithm": "spdx:checksumAlgorithm_sha256", "spdx:checksumValue": item.sha256 },
  })),
  "dcat:keyword": dataPackage.keywords,
  "dcat:distribution": dataPackage.resources.map((resource) => ({
    "@type": "dcat:Distribution",
    "dct:title": resource.title,
    "dct:description": resource.description,
    "dcat:accessURL": `${SITE_ORIGIN}/data/${resource.path}`,
    "dcat:downloadURL": `${SITE_ORIGIN}/data/${resource.path}`,
    "dcat:mediaType": resource.mediatype,
    "dct:format": resource.format,
    "dct:license": "https://creativecommons.org/licenses/by/4.0/legalcode",
  })),
  "dcat:dataDictionary": `${SITE_ORIGIN}/data/datapackage.json`,
};

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
  ["datapackage.json", `${JSON.stringify(dataPackage, null, 2)}\n`],
  ["dcat.jsonld", `${JSON.stringify(dcatRecord, null, 2)}\n`],
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
