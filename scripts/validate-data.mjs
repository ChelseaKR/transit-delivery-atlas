import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ISO_DATE_PATTERN, isIsoDate } from "./iso-date.mjs";
import { passedTimingReport, passedTimings } from "../lib/directive-timing.mjs";
import {
  REVIEW_GRACE_DAYS,
  overdueReviewReport,
  overdueReviews,
} from "../lib/watchlist-review.mjs";

const root = new URL("../", import.meta.url);

// The date the gate judges review currency against. `ATLAS_BUILD_DATE` keeps
// the check reproducible in tests and lets a release be re-run at a fixed date.
const buildDate = (() => {
  const override = process.env.ATLAS_BUILD_DATE?.trim();
  if (!override) return new Date().toISOString().slice(0, 10);
  if (!isIsoDate(override)) {
    throw new Error(
      `ATLAS_BUILD_DATE must be a real ISO calendar date (received ${JSON.stringify(override)}).`,
    );
  }
  return override;
})();

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const date = z
  .string()
  .regex(ISO_DATE_PATTERN)
  .refine(isIsoDate, "must be a real ISO calendar date");
const identifier = z.string().regex(/^[a-z0-9-]+$/);

const locatorSchema = z
  .object({
    section: z.string().min(1),
    pages: z.array(z.number().int().min(1).max(5)).min(1),
  })
  .strict();

const sourceSchema = z
  .object({
    id: identifier,
    type: z.literal("executive-order"),
    title: z.string().min(1),
    publisher: z.string().min(1),
    issuedOn: date,
    effectiveOn: date,
    url: z.string().url().startsWith("https://"),
    contextUrl: z.string().url().startsWith("https://"),
    retrievedOn: date,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    notes: z.string().min(1),
  })
  .strict();

const organizationSchema = z
  .object({
    id: identifier,
    name: z.string().min(1),
    shortName: z.string().min(1),
    kind: z.enum([
      "state-agency",
      "state-commission",
      "state-program",
      "state-office",
      "federal-agency",
      "role-group",
    ]),
  })
  .strict();

const themeSchema = z
  .object({ id: identifier, name: z.string().min(1) })
  .strict();

const timingSchema = z
  .object({
    sourceText: z.string().min(1),
    kind: z.literal("relative"),
    value: z.number().int().positive(),
    unit: z.enum(["calendar-days", "calendar-year"]),
    derivedDate: date,
    derivation: z.string().min(1),
    appliesTo: z.string().min(1),
  })
  .strict();

const qualifierSchema = z
  .object({
    text: z.string().min(1),
    appliesTo: z.string().min(1),
  })
  .strict();

const sourceNoteSchema = z
  .object({
    type: z.literal("transcription"),
    text: z.string().min(1),
  })
  .strict();

const directiveSchema = z
  .object({
    id: identifier,
    order: z.number().int().min(1).max(21),
    label: z.string().min(1),
    title: z.string().min(1),
    titleOrigin: z.literal("editorial"),
    sourceId: identifier,
    locator: locatorSchema,
    excerpt: z.string().min(20),
    leadOrgIds: z.array(identifier).min(1),
    collaboratorOrgIds: z.array(identifier),
    mentionedOrgIds: z.array(identifier),
    sourceContextIds: z.array(identifier),
    qualifiers: z.array(qualifierSchema),
    sourceNotes: z.array(sourceNoteSchema),
    timing: z.array(timingSchema),
    lastReviewedOn: date,
  })
  .strict();

const analyticalItemSchema = z
  .object({
    text: z.string().min(1),
    origin: z.literal("inferred"),
    confidence: z.enum(["low", "medium", "high"]),
  })
  .strict();

const dependencySchema = analyticalItemSchema
  .extend({ relatedDirectiveIds: z.array(identifier) })
  .strict();

const analysisSchema = z
  .object({
    directiveId: identifier,
    summary: z.string().min(20),
    themeIds: z.array(identifier).min(1),
    expectedOutputs: z.array(analyticalItemSchema).min(1),
    dependencies: z.array(dependencySchema).min(1),
    openQuestions: z.array(z.string().min(10)).min(1),
  })
  .strict();

const evidenceDirectiveLinkSchema = z
  .object({
    directiveId: identifier,
    relationship: z.literal("explicit-citation"),
    excerpt: z.string().min(10),
    locator: z
      .object({
        pages: z.array(z.number().int().positive()).min(1),
        locations: z.array(z.string().min(10)).min(1),
      })
      .strict(),
  })
  .strict();

const evidenceSchema = z
  .object({
    id: identifier,
    title: z.string().min(1),
    titleOrigin: z.literal("publisher"),
    publisher: z.string().min(1),
    evidenceType: z.enum([
      "reference-material",
      "meeting-material",
      "draft-guideline",
      "final-guideline",
      "report",
    ]),
    datedOn: date,
    dateKind: z.enum(["scheduled-event", "published", "adopted", "effective"]),
    dateOrigin: z.literal("artifact-header"),
    url: z.string().url().startsWith("https://"),
    contextUrl: z.string().url().startsWith("https://"),
    retrievedOn: date,
    lastReviewedOn: date,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    mediaType: z.literal("application/pdf"),
    pageCount: z.number().int().positive(),
    accessibility: z
      .object({
        tagged: z.boolean(),
        note: z.string().min(20),
      })
      .strict(),
    editorialSummary: z.string().min(20),
    directiveLinks: z.array(evidenceDirectiveLinkSchema).min(1),
    limitations: z.array(z.string().min(20)).min(1),
  })
  .strict();

const watchlistRelatedUrlSchema = z
  .object({
    label: z.string().min(3),
    url: z.string().url().startsWith("https://"),
  })
  .strict();

const watchlistSourceDateSchema = z
  .object({
    value: date,
    kind: z.enum(["scheduled-event", "published", "updated"]),
    origin: z.enum([
      "artifact-header",
      "page-header",
      "page-content",
      "publisher-metadata",
    ]),
  })
  .strict();

const watchlistEvidenceBoundarySchema = z
  .object({
    reason: z.enum([
      "no-explicit-order-citation",
      "expected-artifact-not-published",
    ]),
    checkedOn: date,
    explicitOrderCitation: z.literal(false),
    note: z.string().min(40),
  })
  .strict();

const watchlistDirectiveLinkSchema = z
  .object({
    directiveId: identifier,
    relationship: z.enum([
      "topic-alignment",
      "process-adjacency",
      "publication-watch",
    ]),
    rationale: z.string().min(30),
  })
  .strict();

const watchlistItemSchema = z
  .object({
    id: identifier,
    kind: z.enum(["context-source", "publication-checkpoint"]),
    title: z.string().min(1),
    titleOrigin: z.enum(["publisher", "editorial"]),
    publisher: z.string().min(1),
    url: z.string().url().startsWith("https://"),
    mediaType: z.enum(["text/html", "application/pdf"]),
    relatedUrls: z.array(watchlistRelatedUrlSchema),
    sourceDate: watchlistSourceDateSchema.optional(),
    retrievedOn: date,
    lastReviewedOn: date,
    editorialSummary: z.string().min(40),
    whyTracked: z.string().min(40),
    evidenceBoundary: watchlistEvidenceBoundarySchema,
    directiveLinks: z.array(watchlistDirectiveLinkSchema).min(1),
    nextReviewOn: date,
    watchFor: z.array(z.string().min(30)).min(1),
    limitations: z.array(z.string().min(30)).min(1),
  })
  .strict();

const watchlistSchema = z
  .object({
    schemaVersion: z.literal("0.1.0"),
    scope: z.literal("selective-context"),
    lastUpdatedOn: date,
    boundaryNote: z.string().min(100),
    items: z.array(watchlistItemSchema).min(1),
  })
  .strict();

const feasibilitySourceSchema = z
  .object({
    id: identifier,
    publisher: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url().startsWith("https://"),
    publishedOn: date,
    retrievedOn: date,
    scopeNote: z.string().min(20),
  })
  .strict();

const fieldDefinitionSchema = z
  .object({
    field: z.string().min(1),
    form: z.string().min(1),
    definition: z.string().min(20),
    sourceId: identifier,
    locator: z.string().min(1),
  })
  .strict();

const feasibilityFieldSchema = z
  .object({
    id: identifier,
    label: z.string().min(1),
    tda: fieldDefinitionSchema,
    ntd: fieldDefinitionSchema,
    classification: z.enum([
      "conditionally-automatable",
      "assistable-human-method-review",
      "reconciliation-required",
    ]),
    confidence: z.enum(["low", "medium", "high"]),
    finding: z.string().min(50),
    requiredControls: z.array(z.string().min(20)).min(3),
    remainingEvidence: z.array(z.string().min(20)).min(2),
  })
  .strict();

const feasibilitySchema = z
  .object({
    schemaVersion: z.literal("0.1.0"),
    researchId: z.literal("tda-ntd-four-field-feasibility"),
    directiveId: z.literal("n-7-26-3b"),
    title: z.string().min(1),
    reviewedOn: date,
    basis: z.string().min(50),
    conclusion: z.string().min(80),
    classificationDefinitions: z
      .array(
        z
          .object({
            id: z.enum([
              "conditionally-automatable",
              "assistable-human-method-review",
              "reconciliation-required",
            ]),
            label: z.string().min(1),
            meaning: z.string().min(50),
          })
          .strict(),
      )
      .length(3),
    sources: z.array(feasibilitySourceSchema).min(4),
    reportingPaths: z
      .array(
        z
          .object({
            id: z.enum(["urban-reduced-direct", "california-rural-5311"]),
            label: z.string().min(1),
            description: z.string().min(80),
            sourceIds: z.array(identifier).min(1),
          })
          .strict(),
      )
      .length(2),
    fields: z.array(feasibilityFieldSchema).length(4),
    crossCuttingControls: z.array(z.string().min(20)).min(4),
    nextEvidenceStep: z.string().min(50),
  })
  .strict();

const [
  sources,
  organizations,
  themes,
  directiveData,
  analysisData,
  evidenceData,
  watchlistData,
  feasibilityData,
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
  ]);

z.array(sourceSchema).min(1).parse(sources);
z.array(organizationSchema).min(1).parse(organizations);
z.array(themeSchema).min(1).parse(themes);

z.object({
  schemaVersion: z.literal("0.3.0"),
  orderMetadata: z
    .object({
      directiveCount: z.literal(21),
      administrativeDirectives: z.array(
        z
          .object({
            locator: locatorSchema,
            excerpt: z.string().min(20),
            timingText: z.string().min(1),
          })
          .strict(),
      ),
      sourceContexts: z.array(
        z
          .object({
            id: identifier,
            locator: locatorSchema,
            excerpt: z.string().min(20),
            appliesToDirectiveIds: z.array(identifier).min(1),
            mentionedOrgIds: z.array(identifier),
          })
          .strict(),
      ),
      sourceNotices: z.array(
        z
          .object({
            id: identifier,
            locator: locatorSchema,
            excerpt: z.string().min(20),
          })
          .strict(),
      ),
    })
    .strict(),
  directives: z.array(directiveSchema).length(21),
})
  .strict()
  .parse(directiveData);

z.object({
  schemaVersion: z.literal("0.3.0"),
  analysis: z.array(analysisSchema).length(21),
})
  .strict()
  .parse(analysisData);

const reviewSourceSchema = z
  .object({
    id: identifier,
    name: z.string().min(5),
    publisher: z.string().min(1),
    url: z.string().url().startsWith("https://"),
    coversDirectiveIds: z.array(identifier).min(1),
    lastCheckedOn: date,
    lastCheckOutcome: z.enum(["checked", "retrieval-failed"]),
    note: z.string().min(30),
  })
  .strict();

const sweepSchema = z
  .object({
    sweptOn: date,
    sourceIds: z.array(identifier).min(1),
    addedEvidenceIds: z.array(identifier),
    note: z.string().min(40),
  })
  .strict();

z.object({
  schemaVersion: z.literal("0.3.0"),
  scope: z.literal("selective"),
  lastUpdatedOn: date,
  nextReviewOn: date,
  reviewCommitment: z.string().min(100),
  coverageNote: z.string().min(50),
  reviewSources: z.array(reviewSourceSchema).min(1),
  sweeps: z.array(sweepSchema).min(1),
  evidence: z.array(evidenceSchema).min(1),
})
  .strict()
  .parse(evidenceData);

watchlistSchema.parse(watchlistData);

feasibilitySchema.parse(feasibilityData);

function unique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new Error(`${label} contains duplicates: ${[...new Set(duplicates)].join(", ")}`);
  }
}

const expectedIds = [
  "n-7-26-1a",
  "n-7-26-1b",
  "n-7-26-1c",
  "n-7-26-1d",
  "n-7-26-1e",
  "n-7-26-1f",
  "n-7-26-1g",
  "n-7-26-2",
  "n-7-26-3a",
  "n-7-26-3b",
  "n-7-26-3c",
  "n-7-26-3d",
  "n-7-26-3e",
  "n-7-26-3f",
  "n-7-26-3g",
  "n-7-26-3h",
  "n-7-26-3i",
  "n-7-26-3j",
  "n-7-26-4",
  "n-7-26-5",
  "n-7-26-6",
];

const sourceIds = new Set(sources.map(({ id }) => id));
const organizationIds = new Set(organizations.map(({ id }) => id));
const themeIds = new Set(themes.map(({ id }) => id));
const directiveIds = directiveData.directives.map(({ id }) => id);
const sourceContextIds = directiveData.orderMetadata.sourceContexts.map(({ id }) => id);
const sourceNoticeIds = directiveData.orderMetadata.sourceNotices.map(({ id }) => id);
const sourceContextIdSet = new Set(sourceContextIds);

unique(sources.map(({ id }) => id), "Source IDs");
unique(organizations.map(({ id }) => id), "Organization IDs");
unique(themes.map(({ id }) => id), "Theme IDs");
unique(directiveIds, "Directive IDs");
unique(analysisData.analysis.map(({ directiveId }) => directiveId), "Analysis IDs");
unique(evidenceData.evidence.map(({ id }) => id), "Evidence IDs");
unique(evidenceData.evidence.map(({ url }) => url), "Evidence URLs");
unique(watchlistData.items.map(({ id }) => id), "Watchlist IDs");
unique(watchlistData.items.map(({ url }) => url), "Watchlist URLs");
unique(sourceContextIds, "Source context IDs");
unique(sourceNoticeIds, "Source notice IDs");
unique(
  feasibilityData.classificationDefinitions.map(({ id }) => id),
  "Feasibility classification IDs",
);
unique(
  feasibilityData.sources.map(({ id }) => id),
  "Feasibility source IDs",
);
unique(
  feasibilityData.fields.map(({ id }) => id),
  "Feasibility field IDs",
);
unique(
  feasibilityData.reportingPaths.map(({ id }) => id),
  "Feasibility reporting-path IDs",
);

const expectedFeasibilityFieldIds = [
  "unlinked-passenger-trips",
  "vehicle-revenue-miles",
  "vehicle-revenue-hours",
  "total-operating-expense",
];

if (
  JSON.stringify(feasibilityData.fields.map(({ id }) => id)) !==
  JSON.stringify(expectedFeasibilityFieldIds)
) {
  throw new Error("The TDA/NTD feasibility slice must preserve the reviewed four-field order.");
}

const feasibilitySourceIds = new Set(
  feasibilityData.sources.map(({ id }) => id),
);
for (const field of feasibilityData.fields) {
  for (const layer of ["tda", "ntd"]) {
    if (!feasibilitySourceIds.has(field[layer].sourceId)) {
      throw new Error(`${field.id}.${layer} references an unknown feasibility source.`);
    }
  }
}
for (const path of feasibilityData.reportingPaths) {
  unique(path.sourceIds, `${path.id} feasibility source IDs`);
  for (const sourceId of path.sourceIds) {
    if (!feasibilitySourceIds.has(sourceId)) {
      throw new Error(`${path.id} references an unknown feasibility source.`);
    }
  }
}

if (
  feasibilityData.fields.filter(
    ({ classification }) => classification === "conditionally-automatable",
  ).length !== 2 ||
  feasibilityData.fields.filter(
    ({ classification }) => classification === "assistable-human-method-review",
  ).length !== 1 ||
  feasibilityData.fields.filter(
    ({ classification }) => classification === "reconciliation-required",
  ).length !== 1
) {
  throw new Error(
    "The reviewed feasibility boundary must retain two conditional calculations, one assisted method review, and one reconciliation.",
  );
}

if (JSON.stringify(directiveIds) !== JSON.stringify(expectedIds)) {
  throw new Error("Directive IDs or document order differ from the 21-unit signed structure.");
}

if (directiveIds.filter((id) => id === "n-7-26-3b").length !== 1) {
  throw new Error("The signed structure must contain exactly one Section 3(b) record.");
}

for (const context of directiveData.orderMetadata.sourceContexts) {
  unique(context.appliesToDirectiveIds, `${context.id} directive references`);
  unique(context.mentionedOrgIds, `${context.id} organization references`);
  for (const directiveId of context.appliesToDirectiveIds) {
    if (!directiveIds.includes(directiveId)) {
      throw new Error(`${context.id} references unknown directive ${directiveId}.`);
    }
  }
  for (const orgId of context.mentionedOrgIds) {
    if (!organizationIds.has(orgId)) {
      throw new Error(`${context.id} references unknown organization ${orgId}.`);
    }
  }
}

const sectionThreeIds = expectedIds.filter((id) => /^n-7-26-3[a-j]$/.test(id));
const sectionThreeContext = directiveData.orderMetadata.sourceContexts.find(
  ({ id }) => id === "section-3-preamble",
);
if (
  !sectionThreeContext ||
  JSON.stringify(sectionThreeContext.appliesToDirectiveIds) !== JSON.stringify(sectionThreeIds) ||
  !sectionThreeContext.mentionedOrgIds.includes("cimp")
) {
  throw new Error("Section 3 source context must cover 3(a)–3(j) and preserve CIMP.");
}

const nonEnforceability = directiveData.orderMetadata.sourceNotices.find(
  ({ id }) => id === "non-enforceability",
);
if (
  !nonEnforceability?.excerpt.includes("does not, create any rights or benefits") ||
  !nonEnforceability.excerpt.includes("enforceable at law or in equity")
) {
  throw new Error("Order metadata must preserve the signed non-enforceability clause.");
}

for (const [index, directive] of directiveData.directives.entries()) {
  if (directive.order !== index + 1) {
    throw new Error(`${directive.id} has non-sequential order ${directive.order}.`);
  }
  if (!sourceIds.has(directive.sourceId)) {
    throw new Error(`${directive.id} references unknown source ${directive.sourceId}.`);
  }
  for (const orgId of [
    ...directive.leadOrgIds,
    ...directive.collaboratorOrgIds,
    ...directive.mentionedOrgIds,
  ]) {
    if (!organizationIds.has(orgId)) {
      throw new Error(`${directive.id} references unknown organization ${orgId}.`);
    }
  }
  const relationshipOrgIds = [
    ...directive.leadOrgIds,
    ...directive.collaboratorOrgIds,
    ...directive.mentionedOrgIds,
  ];
  unique(relationshipOrgIds, `${directive.id} organization roles`);
  unique(directive.sourceContextIds, `${directive.id} source contexts`);
  unique(
    directive.qualifiers.map(({ text }) => text),
    `${directive.id} qualifier text`,
  );
  unique(
    directive.sourceNotes.map(({ text }) => text),
    `${directive.id} source notes`,
  );
  for (const contextId of directive.sourceContextIds) {
    if (!sourceContextIdSet.has(contextId)) {
      throw new Error(`${directive.id} references unknown source context ${contextId}.`);
    }
    const context = directiveData.orderMetadata.sourceContexts.find(({ id }) => id === contextId);
    if (!context.appliesToDirectiveIds.includes(directive.id)) {
      throw new Error(`${directive.id} references source context ${contextId} that does not apply to it.`);
    }
  }

  const isSectionThree = /^n-7-26-3[a-j]$/.test(directive.id);
  if (isSectionThree && !directive.sourceContextIds.includes("section-3-preamble")) {
    throw new Error(`${directive.id} is missing the Section 3 source context.`);
  }
  if (!isSectionThree && directive.sourceContextIds.includes("section-3-preamble")) {
    throw new Error(`${directive.id} incorrectly inherits the Section 3 source context.`);
  }

  const isSectionOne = /^n-7-26-1[a-g]$/.test(directive.id);
  if (isSectionOne) {
    const inherited = directive.timing.find(
      ({ sourceText, derivedDate }) =>
        sourceText === "Within 120 days of this Order" &&
        derivedDate === "2026-10-24",
    );
    if (!inherited) {
      throw new Error(`${directive.id} is missing the Section 1 timing inheritance.`);
    }
  } else if (directive.timing.length > 0) {
    throw new Error(`${directive.id} has an invented explicit deadline.`);
  }

  if (directive.id === "n-7-26-1e") {
    const completion = directive.timing.find(
      ({ sourceText, derivedDate }) =>
        sourceText === "within one year" && derivedDate === "2027-06-26",
    );
    if (!completion || directive.timing.length !== 2) {
      throw new Error("Section 1(e) must contain both start and completion milestones.");
    }
  } else if (isSectionOne && directive.timing.length !== 1) {
    throw new Error(`${directive.id} should contain exactly one inherited milestone.`);
  }
}

const directiveById = new Map(
  directiveData.directives.map((directive) => [directive.id, directive]),
);

const sectionThreeA = directiveById.get("n-7-26-3a");
if (
  sectionThreeA.collaboratorOrgIds.includes("regions") ||
  !sectionThreeA.mentionedOrgIds.includes("regions")
) {
  throw new Error("Section 3(a) must classify regions as a named party, not a collaborator.");
}

const sectionThreeD = directiveById.get("n-7-26-3d");
if (
  sectionThreeD.collaboratorOrgIds.length !== 0 ||
  !["usdot", "fta"].every((id) => sectionThreeD.mentionedOrgIds.includes(id)) ||
  !sectionThreeD.sourceNotes.some(({ type }) => type === "transcription")
) {
  throw new Error("Section 3(d) must preserve federal assignment authorities and its source-wording note.");
}

const sectionThreeE = directiveById.get("n-7-26-3e");
if (
  sectionThreeE.collaboratorOrgIds.length !== 0 ||
  !sectionThreeE.mentionedOrgIds.includes("local-agencies")
) {
  throw new Error("Section 3(e) must classify local agencies as assistance recipients.");
}

const sectionThreeF = directiveById.get("n-7-26-3f");
if (
  !sectionThreeF.excerpt.includes("fully digitize its real estate holdings") ||
  !sectionThreeF.excerpt.includes("inventory buildings and their state of repair")
) {
  throw new Error("Section 3(f) must preserve the digitization and repair-state inventory actions.");
}

const sectionFour = directiveById.get("n-7-26-4");
const sectionFourQualifier = sectionFour.qualifiers.find(({ text }) => text === "where possible");
if (sectionFourQualifier?.appliesTo !== "undertaking programmatic environmental review") {
  throw new Error("Section 4 must scope ‘where possible’ only to programmatic review.");
}

const sectionFive = directiveById.get("n-7-26-5");
if (
  !["calsta", "caltrans"].every((id) => sectionFive.leadOrgIds.includes(id)) ||
  !sectionFive.excerpt.includes("Caltrans shall also identify federal funding programs")
) {
  throw new Error("Section 5 must preserve both explicit leads and the federal-program action.");
}

const sectionSix = directiveById.get("n-7-26-6");
if (
  JSON.stringify(sectionSix.collaboratorOrgIds) !== JSON.stringify(["caltrans-it"]) ||
  !["calitp", "cimp", "grantees-subrecipients"].every((id) =>
    sectionSix.mentionedOrgIds.includes(id),
  )
) {
  throw new Error("Section 6 must distinguish the named programs from the explicit Caltrans IT partnership.");
}

const analysisIds = new Set(analysisData.analysis.map(({ directiveId }) => directiveId));
for (const directiveId of directiveIds) {
  if (!analysisIds.has(directiveId)) {
    throw new Error(`Missing analytical record for ${directiveId}.`);
  }
}

for (const record of analysisData.analysis) {
  if (!directiveIds.includes(record.directiveId)) {
    throw new Error(`Orphan analysis record ${record.directiveId}.`);
  }
  unique(record.themeIds, `${record.directiveId} analytical themes`);
  for (const themeId of record.themeIds) {
    if (!themeIds.has(themeId)) {
      throw new Error(`${record.directiveId} references unknown theme ${themeId}.`);
    }
  }
  for (const dependency of record.dependencies) {
    unique(
      dependency.relatedDirectiveIds,
      `${record.directiveId} dependency related directives`,
    );
    if (dependency.relatedDirectiveIds.includes(record.directiveId)) {
      throw new Error(`${record.directiveId} dependency cannot reference itself.`);
    }
    for (const relatedId of dependency.relatedDirectiveIds) {
      if (!directiveIds.includes(relatedId)) {
        throw new Error(`${record.directiveId} references unknown directive ${relatedId}.`);
      }
    }
    const relatedOrders = dependency.relatedDirectiveIds.map(
      (relatedId) => directiveById.get(relatedId).order,
    );
    const sortedOrders = [...relatedOrders].sort((left, right) => left - right);
    if (JSON.stringify(relatedOrders) !== JSON.stringify(sortedOrders)) {
      throw new Error(
        `${record.directiveId} dependency references must remain in signed-document order.`,
      );
    }
  }
}

for (const record of evidenceData.evidence) {
  if (record.lastReviewedOn < record.retrievedOn) {
    throw new Error(`${record.id} was reviewed before it was retrieved.`);
  }
  if (record.dateKind !== "scheduled-event" && record.datedOn > record.lastReviewedOn) {
    throw new Error(`${record.id} has a future ${record.dateKind} date.`);
  }
  const linkedDirectiveIds = record.directiveLinks.map(({ directiveId }) => directiveId);
  unique(linkedDirectiveIds, `${record.id} directive links`);
  for (const link of record.directiveLinks) {
    if (!directiveIds.includes(link.directiveId)) {
      throw new Error(`${record.id} references unknown directive ${link.directiveId}.`);
    }
    for (const page of link.locator.pages) {
      if (page > record.pageCount) {
        throw new Error(`${record.id} cites page ${page} beyond its ${record.pageCount}-page artifact.`);
      }
    }
    unique(link.locator.pages, `${record.id} locator pages`);
    unique(link.locator.locations, `${record.id} locator descriptions`);
  }
}

const evidenceLastUpdatedOn = evidenceData.evidence
  .map(({ lastReviewedOn }) => lastReviewedOn)
  .sort()
  .at(-1);
if (evidenceData.lastUpdatedOn !== evidenceLastUpdatedOn) {
  throw new Error("Evidence lastUpdatedOn must equal the latest record review date.");
}

// The evidence layer's forward commitment (issue #59). Without a source list
// and a dated sweep, "no evidence yet" is indistinguishable from "nobody has
// looked", which is the inference the coverage note exists to refuse.
unique(evidenceData.reviewSources.map(({ id }) => id), "Evidence review source IDs");
unique(evidenceData.reviewSources.map(({ url }) => url), "Evidence review source URLs");
const reviewSourceIds = new Set(evidenceData.reviewSources.map(({ id }) => id));
const evidenceIds = new Set(evidenceData.evidence.map(({ id }) => id));
for (const reviewSource of evidenceData.reviewSources) {
  unique(reviewSource.coversDirectiveIds, `${reviewSource.id} directive coverage`);
  for (const directiveId of reviewSource.coversDirectiveIds) {
    if (!directiveIds.includes(directiveId)) {
      throw new Error(`Review source ${reviewSource.id} covers unknown directive ${directiveId}.`);
    }
  }
  if (reviewSource.lastCheckedOn > evidenceData.lastUpdatedOn) {
    throw new Error(
      `Review source ${reviewSource.id} was checked after the collection's lastUpdatedOn.`,
    );
  }
}
const sweepDates = evidenceData.sweeps.map(({ sweptOn }) => sweptOn);
unique(sweepDates, "Evidence sweep dates");
if (JSON.stringify(sweepDates) !== JSON.stringify([...sweepDates].sort())) {
  throw new Error("Evidence sweeps must be recorded in date order.");
}
for (const sweep of evidenceData.sweeps) {
  unique(sweep.sourceIds, `Evidence sweep ${sweep.sweptOn} source IDs`);
  unique(sweep.addedEvidenceIds, `Evidence sweep ${sweep.sweptOn} added evidence IDs`);
  for (const sourceId of sweep.sourceIds) {
    if (!reviewSourceIds.has(sourceId)) {
      throw new Error(`Evidence sweep ${sweep.sweptOn} references unknown review source ${sourceId}.`);
    }
  }
  for (const evidenceId of sweep.addedEvidenceIds) {
    if (!evidenceIds.has(evidenceId)) {
      throw new Error(`Evidence sweep ${sweep.sweptOn} references unknown evidence record ${evidenceId}.`);
    }
  }
}
const latestSweep = evidenceData.sweeps.at(-1);
for (const reviewSource of evidenceData.reviewSources) {
  if (
    latestSweep.sourceIds.includes(reviewSource.id) &&
    reviewSource.lastCheckedOn !== latestSweep.sweptOn
  ) {
    throw new Error(
      `Review source ${reviewSource.id} is listed in the ${latestSweep.sweptOn} sweep but its lastCheckedOn is ${reviewSource.lastCheckedOn}.`,
    );
  }
}
if (latestSweep.sweptOn !== evidenceData.lastUpdatedOn) {
  throw new Error(
    "The latest evidence sweep must be dated the collection's lastUpdatedOn; a sweep that adds nothing still updates the collection.",
  );
}
if (evidenceData.nextReviewOn <= evidenceData.lastUpdatedOn) {
  throw new Error("Evidence nextReviewOn must be after the collection's lastUpdatedOn.");
}

const evidenceUrls = new Set(evidenceData.evidence.map(({ url }) => url));
for (const item of watchlistData.items) {
  if (evidenceUrls.has(item.url)) {
    throw new Error(
      `${item.id} uses a primary URL that is already present in the evidence collection.`,
    );
  }
  if (item.lastReviewedOn < item.retrievedOn) {
    throw new Error(`${item.id} was reviewed before it was retrieved.`);
  }
  if (item.nextReviewOn < item.lastReviewedOn) {
    throw new Error(`${item.id} has a next review date before its latest review.`);
  }
  if (item.evidenceBoundary.checkedOn !== item.lastReviewedOn) {
    throw new Error(
      `${item.id} evidence-boundary check must match its latest review date.`,
    );
  }
  if (
    item.sourceDate &&
    item.sourceDate.kind !== "scheduled-event" &&
    item.sourceDate.value > item.lastReviewedOn
  ) {
    throw new Error(`${item.id} has a future ${item.sourceDate.kind} source date.`);
  }

  unique(
    item.relatedUrls.map(({ label }) => label),
    `${item.id} related URL labels`,
  );
  unique(
    item.relatedUrls.map(({ url }) => url),
    `${item.id} related URLs`,
  );
  unique(item.watchFor, `${item.id} watch-for statements`);
  unique(item.limitations, `${item.id} limitations`);

  const linkedDirectiveIds = item.directiveLinks.map(
    ({ directiveId }) => directiveId,
  );
  unique(linkedDirectiveIds, `${item.id} directive links`);
  for (const link of item.directiveLinks) {
    if (!directiveIds.includes(link.directiveId)) {
      throw new Error(`${item.id} references unknown directive ${link.directiveId}.`);
    }
  }
  const linkedOrders = linkedDirectiveIds.map(
    (directiveId) => directiveById.get(directiveId).order,
  );
  const sortedLinkedOrders = [...linkedOrders].sort((left, right) => left - right);
  if (JSON.stringify(linkedOrders) !== JSON.stringify(sortedLinkedOrders)) {
    throw new Error(
      `${item.id} directive references must remain in signed-document order.`,
    );
  }
}

const watchlistLastUpdatedOn = watchlistData.items
  .map(({ lastReviewedOn }) => lastReviewedOn)
  .sort()
  .at(-1);
if (watchlistData.lastUpdatedOn !== watchlistLastUpdatedOn) {
  throw new Error(
    "Watchlist lastUpdatedOn must equal the latest item review date.",
  );
}

// A planned review date that only has to be later than the last review can
// never expire. Compare it to the build date as well, so a lapsed review is
// noticed by something other than a reader.
// The evidence collection carries one planned review for the whole layer and
// is gated by exactly the rule the watchlist items are: one rule, two layers.
const reviewedCollections = [
  ...watchlistData.items,
  {
    id: "evidence-collection",
    lastReviewedOn: evidenceData.lastUpdatedOn,
    nextReviewOn: evidenceData.nextReviewOn,
  },
];
const overdue = overdueReviews(reviewedCollections, buildDate);
if (overdue.length > 0) {
  const report = overdueReviewReport(overdue, buildDate);
  const beyondGrace = overdue.filter(({ beyondGrace }) => beyondGrace);
  if (beyondGrace.length > 0) {
    throw new Error(
      `${report}\n${beyondGrace.length} of them (${beyondGrace.map(({ id }) => id).join(", ")}) ${beyondGrace.length === 1 ? "is" : "are"} more than the ${REVIEW_GRACE_DAYS}-day grace window overdue, so this release is blocked until the watchlist is re-reviewed.`,
    );
  }
  console.warn(
    `\nWATCHLIST REVIEW OVERDUE\n${report}\nThe release gate fails once an item is more than ${REVIEW_GRACE_DAYS} days overdue.\n`,
  );
}

function rejectStatus(value, path = "root") {
  if (!value || typeof value !== "object") return;
  const forbiddenKeys = new Set([
    "status",
    "progress",
    "percentcomplete",
    "compliance",
    "rating",
    "score",
    "ontrack",
  ]);
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) {
      throw new Error(`Status-like implementation fields are not supported (${path}.${key}).`);
    }
    rejectStatus(child, `${path}.${key}`);
  }
}

rejectStatus(directiveData);
rejectStatus(analysisData);
rejectStatus(evidenceData);
rejectStatus(watchlistData);
rejectStatus(feasibilityData);

console.log(
  `Validated 21 directive records, 21 analysis records, ${evidenceData.evidence.length} evidence record(s), ${watchlistData.items.length} context watchlist item(s), the four-field reporting slice, and all references.`,
);
console.log(
  `Review currency at ${buildDate}: ${overdue.length} of ${reviewedCollections.length} reviewed item(s) (${watchlistData.items.length} watchlist items plus the evidence collection) past their planned review date.`,
);

// Reported, never enforced. A lapsed watchlist review is a defect in the
// Atlas's own upkeep and blocks a release; a calculated planning date arriving
// is a fact about the calendar, and failing on it would block every later
// deploy for something no re-review could clear. The line exists so the date
// moving is visible in CI output rather than only to a reader of the page.
const passedPlanningDates = passedTimings(directiveData.directives, buildDate);
const totalTimings = directiveData.directives.reduce(
  (count, directive) => count + directive.timing.length,
  0,
);
console.log(passedTimingReport(passedPlanningDates, totalTimings, buildDate));
