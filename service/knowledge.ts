import { readFile } from "node:fs/promises";
import { directiveEvidenceCoverage, coverageStatement } from "../lib/evidence-coverage.mjs";
import { loadCorpus, quoteIsVerbatim } from "../lib/corpus.mjs";
import type { Field } from "./schemas.ts";

/**
 * Everything the narrator is allowed to know, assembled by the service from the
 * canonical data and the retained corpus. The model never reads data/ itself;
 * it reads this, and it can refer to a quotation or an evidence record only by
 * the IDs this module mints.
 */

const root = new URL("../", import.meta.url);

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(new URL(path, root), "utf8")) as T;
}

interface RawDirective {
  id: string;
  order: number;
  label: string;
  title: string;
  locator: { section: string; pages: number[] };
  excerpt: string;
  leadOrgIds: string[];
  collaboratorOrgIds: string[];
  mentionedOrgIds: string[];
  sourceContextIds: string[];
  qualifiers: Array<{ text: string; appliesTo: string }>;
  sourceNotes: Array<{ type: string; text: string }>;
  timing: Array<{ sourceText: string; derivedDate: string; derivation: string; appliesTo: string }>;
  lastReviewedOn: string;
}

interface RawOrganization {
  id: string;
  name: string;
  shortName: string;
  kind: string;
}

interface RawEvidence {
  id: string;
  title: string;
  publisher: string;
  evidenceType: string;
  datedOn: string;
  dateKind: string;
  url: string;
  contextUrl: string;
  lastReviewedOn: string;
  editorialSummary: string;
  directiveLinks: Array<{ directiveId: string; excerpt: string; locator: { pages: number[]; locations: string[] } }>;
  limitations: string[];
}

export interface Quote {
  ref: string;
  text: string;
  section: string;
  pages: number[];
  directiveId: string | null;
  label: string;
}

export interface DirectiveFacts {
  id: string;
  label: string;
  title: string;
  section: string;
  pages: number[];
  sourceUrl: string;
  lastReviewedOn: string;
  excerptRef: string;
  contextRefs: string[];
  qualifiers: Array<{ text: string; appliesTo: string }>;
  sourceNotes: string[];
  leadOrganizations: RawOrganization[];
  collaboratorOrganizations: RawOrganization[];
  mentionedOrganizations: RawOrganization[];
  timing: Array<{ sourceText: string; derivedDate: string; derivation: string; appliesTo: string }>;
  evidence: RawEvidence[];
  coverage: ReturnType<typeof directiveEvidenceCoverage> & { statement: string };
  analysisSummary: string;
  openQuestions: string[];
}

export interface Knowledge {
  directives: RawDirective[];
  organizations: RawOrganization[];
  evidence: RawEvidence[];
  evidenceScope: {
    lastUpdatedOn: string;
    nextReviewOn: string;
    reviewSources: Array<{ id: string; name: string; publisher: string; url: string; coversDirectiveIds: string[]; lastCheckedOn: string; lastCheckOutcome: string; note: string }>;
  };
  sourceUrl: string;
  corpusText: string;
  corpusSha256: string;
  quotes: Map<string, Quote>;
  directiveById: Map<string, RawDirective>;
  organizationById: Map<string, RawOrganization>;
  evidenceById: Map<string, RawEvidence>;
  analysisById: Map<string, { summary: string; openQuestions: string[] }>;
  factsFor(directiveId: string): DirectiveFacts;
  resolveDirective(reference: string): RawDirective | undefined;
}

/** `quote:<id>` references the reviewed excerpt of a directive or order context. */
export function quoteRef(id: string): string {
  return `quote:${id}`;
}

export async function loadKnowledge(): Promise<Knowledge> {
  const [directiveData, analysisData, evidenceData, organizations, sources, corpus] = await Promise.all([
    readJson<{ directives: RawDirective[]; orderMetadata: { sourceContexts: Array<{ id: string; locator: { section: string; pages: number[] }; excerpt: string; appliesToDirectiveIds: string[] }>; sourceNotices: Array<{ id: string; locator: { section: string; pages: number[] }; excerpt: string }> } }>("data/directives.json"),
    readJson<{ analysis: Array<{ directiveId: string; summary: string; openQuestions: string[] }> }>("data/analysis.json"),
    readJson<{ lastUpdatedOn: string; nextReviewOn: string; reviewSources: Knowledge["evidenceScope"]["reviewSources"]; evidence: RawEvidence[] }>("data/evidence.json"),
    readJson<RawOrganization[]>("data/organizations.json"),
    readJson<Array<{ id: string; url: string }>>("data/sources.json"),
    loadCorpus(),
  ]);

  const quotes = new Map<string, Quote>();
  const register = (quote: Quote) => {
    const check = quoteIsVerbatim(quote.text, corpus.text);
    if (!check.verbatim) {
      // The corpus test already proves this for the committed data; failing
      // here keeps a later edit from minting a quotation the corpus cannot back.
      throw new Error(`Reviewed excerpt ${quote.ref} is not verbatim in the retained corpus: ${check.reason}`);
    }
    quotes.set(quote.ref, quote);
  };
  for (const directive of directiveData.directives) {
    register({
      ref: quoteRef(directive.id),
      text: directive.excerpt,
      section: directive.locator.section,
      pages: directive.locator.pages,
      directiveId: directive.id,
      label: `Directive ${directive.label}, section ${directive.locator.section}`,
    });
  }
  for (const context of directiveData.orderMetadata.sourceContexts) {
    register({
      ref: quoteRef(context.id),
      text: context.excerpt,
      section: context.locator.section,
      pages: context.locator.pages,
      directiveId: null,
      label: `Order section ${context.locator.section} (context inherited by ${context.appliesToDirectiveIds.length} directives)`,
    });
  }
  for (const notice of directiveData.orderMetadata.sourceNotices) {
    register({
      ref: quoteRef(notice.id),
      text: notice.excerpt,
      section: notice.locator.section,
      pages: notice.locator.pages,
      directiveId: null,
      label: `Order ${notice.locator.section}`,
    });
  }

  const directiveById = new Map(directiveData.directives.map((directive) => [directive.id, directive]));
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const evidenceById = new Map(evidenceData.evidence.map((record) => [record.id, record]));
  const analysisById = new Map(
    analysisData.analysis.map((item) => [item.directiveId, { summary: item.summary, openQuestions: item.openQuestions }]),
  );
  const sourceUrl = sources[0].url;

  const knowledge: Knowledge = {
    directives: directiveData.directives,
    organizations,
    evidence: evidenceData.evidence,
    evidenceScope: {
      lastUpdatedOn: evidenceData.lastUpdatedOn,
      nextReviewOn: evidenceData.nextReviewOn,
      reviewSources: evidenceData.reviewSources,
    },
    sourceUrl,
    corpusText: corpus.text,
    corpusSha256: corpus.manifest.files.text.sha256,
    quotes,
    directiveById,
    organizationById,
    evidenceById,
    analysisById,
    factsFor(directiveId: string): DirectiveFacts {
      const directive = directiveById.get(directiveId);
      if (!directive) throw new Error(`Unknown directive ${directiveId}`);
      const organization = (id: string) => {
        const found = organizationById.get(id);
        if (!found) throw new Error(`Unknown organization ${id}`);
        return found;
      };
      const coverage = directiveEvidenceCoverage(directiveId, evidenceData);
      const analysis = analysisById.get(directiveId) ?? { summary: "", openQuestions: [] };
      return {
        id: directive.id,
        label: directive.label,
        title: directive.title,
        section: directive.locator.section,
        pages: directive.locator.pages,
        sourceUrl,
        lastReviewedOn: directive.lastReviewedOn,
        excerptRef: quoteRef(directive.id),
        contextRefs: directive.sourceContextIds.map(quoteRef),
        qualifiers: directive.qualifiers,
        sourceNotes: directive.sourceNotes.map(({ text }) => text),
        leadOrganizations: directive.leadOrgIds.map(organization),
        collaboratorOrganizations: directive.collaboratorOrgIds.map(organization),
        mentionedOrganizations: directive.mentionedOrgIds.map(organization),
        timing: directive.timing,
        evidence: evidenceData.evidence.filter((record) =>
          record.directiveLinks.some((link) => link.directiveId === directiveId),
        ),
        coverage: { ...coverage, statement: coverageStatement(coverage) },
        analysisSummary: analysis.summary,
        openQuestions: analysis.openQuestions,
      };
    },
    resolveDirective(reference: string): RawDirective | undefined {
      const trimmed = reference.trim();
      if (directiveById.has(trimmed)) return directiveById.get(trimmed);
      const normalized = trimmed
        .toLowerCase()
        .replace(/^(?:directive|section|order|paragraph|item|§)\s*/u, "")
        .replace(/[\s().]/g, "");
      return directiveData.directives.find(
        (directive) =>
          directive.label.toLowerCase().replace(/[\s().]/g, "") === normalized ||
          directive.id === `n-7-26-${normalized}`,
      );
    },
  };
  return knowledge;
}

/**
 * The directive index the structuring step sees: enough to map a question to
 * IDs, and nothing that could be mistaken for a finding.
 */
export function directiveIndex(knowledge: Knowledge): string {
  return knowledge.directives
    .map((directive) => {
      const leads = directive.leadOrgIds.map((id) => knowledge.organizationById.get(id)?.shortName ?? id).join(", ");
      const evidenceCount = knowledge.evidence.filter((record) =>
        record.directiveLinks.some((link) => link.directiveId === directive.id),
      ).length;
      return `${directive.id} | ${directive.label} | ${directive.title} | lead: ${leads} | timing: ${directive.timing.map((t) => t.sourceText).join("; ") || "none stated"} | evidence records: ${evidenceCount}`;
    })
    .join("\n");
}

/** Which fields a lookup needs when the structuring step named none. */
export function defaultFields(intent: "directive-lookup" | "evidence-lookup"): Field[] {
  return intent === "evidence-lookup"
    ? ["evidence"]
    : ["source-language", "responsible-bodies", "timing"];
}
