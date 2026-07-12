import { readFile } from "node:fs/promises";
import { z } from "zod";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
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

const [sources, organizations, themes, directiveData, analysisData] =
  await Promise.all([
    readJson("data/sources.json"),
    readJson("data/organizations.json"),
    readJson("data/themes.json"),
    readJson("data/directives.json"),
    readJson("data/analysis.json"),
  ]);

z.array(sourceSchema).min(1).parse(sources);
z.array(organizationSchema).min(1).parse(organizations);
z.array(themeSchema).min(1).parse(themes);

z.object({
  schemaVersion: z.literal("0.1.0"),
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
  schemaVersion: z.literal("0.1.0"),
  analysis: z.array(analysisSchema).length(21),
})
  .strict()
  .parse(analysisData);

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

unique([...sourceIds], "Source IDs");
unique([...organizationIds], "Organization IDs");
unique([...themeIds], "Theme IDs");
unique(directiveIds, "Directive IDs");
unique(analysisData.analysis.map(({ directiveId }) => directiveId), "Analysis IDs");
unique(sourceContextIds, "Source context IDs");
unique(sourceNoticeIds, "Source notice IDs");

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
  for (const themeId of record.themeIds) {
    if (!themeIds.has(themeId)) {
      throw new Error(`${record.directiveId} references unknown theme ${themeId}.`);
    }
  }
  for (const dependency of record.dependencies) {
    for (const relatedId of dependency.relatedDirectiveIds) {
      if (!directiveIds.includes(relatedId)) {
        throw new Error(`${record.directiveId} references unknown directive ${relatedId}.`);
      }
    }
  }
}

function rejectStatus(value, path = "root") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase() === "status") {
      throw new Error(`Mutable implementation status is not supported (${path}.${key}).`);
    }
    rejectStatus(child, `${path}.${key}`);
  }
}

rejectStatus(directiveData);
rejectStatus(analysisData);

console.log("Validated 21 directive records, 21 analysis records, and all references.");
