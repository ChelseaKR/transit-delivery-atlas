import { quoteIsVerbatim } from "../lib/corpus.mjs";
import { withholdVerdictSentences } from "../lib/verdict-language.mjs";
import type { DirectiveFacts, Knowledge } from "./knowledge.ts";
import type { Field, Narration } from "./schemas.ts";

/**
 * The verifier: everything between the model and the reader.
 *
 * It resolves every reference the model made, withholds what it cannot back,
 * inserts the site's own empty-state wording and a freshness block by
 * construction, and counts what it withheld so the reader can see it.
 */

export type AnswerBlock =
  | { type: "text"; text: string }
  | { type: "quote"; ref: string; text: string; label: string; section: string; pages: number[]; sourceUrl: string; verified: "verbatim-in-retained-corpus" }
  | { type: "evidence"; id: string; title: string; publisher: string; evidenceType: string; datedOn: string; dateKind: string; lastReviewedOn: string; url: string; contextUrl: string; citation: string; pages: number[]; limitations: string[] }
  | { type: "empty-state"; directiveId: string; label: string; statement: string; lastCheckedOn: string | null; nextReviewOn: string }
  | { type: "freshness"; items: Array<{ directiveId: string; label: string; evidence: Array<{ id: string; lastReviewedOn: string }>; coverageState: string; sourcesLastCheckedOn: string | null; nextReviewOn: string; statement: string }> };

export interface Withheld {
  kind: "quote" | "evidence" | "empty-state" | "text-quotation" | "verdict" | "unknown-segment";
  detail: string;
}

export interface VerifiedAnswer {
  blocks: AnswerBlock[];
  withheld: Withheld[];
}

/** Quoted spans inside free text that are long enough to be a claim of quotation. */
const QUOTED_SPAN = /[“"]([^”"]{12,})[”"]/g;

export function verifyNarration(
  narration: Narration,
  facts: DirectiveFacts[],
  fields: Field[],
  knowledge: Knowledge,
): VerifiedAnswer {
  const blocks: AnswerBlock[] = [];
  const withheld: Withheld[] = [];
  const factsById = new Map(facts.map((item) => [item.id, item]));
  const allowedQuoteRefs = new Set<string>();
  for (const item of facts) {
    allowedQuoteRefs.add(item.excerptRef);
    for (const ref of item.contextRefs) allowedQuoteRefs.add(ref);
  }
  // Order-wide notices may be quoted for any directive.
  for (const [ref, quote] of knowledge.quotes) {
    if (quote.directiveId === null && ref.startsWith("quote:non-") ) allowedQuoteRefs.add(ref);
  }
  const emittedEmptyStates = new Set<string>();

  for (const segment of narration.segments) {
    switch (segment.kind) {
      case "quote": {
        const ref = segment.ref ?? "";
        const quote = knowledge.quotes.get(ref);
        if (!quote) {
          withheld.push({ kind: "quote", detail: `unknown quotation reference ${JSON.stringify(ref)}` });
          break;
        }
        if (!allowedQuoteRefs.has(ref)) {
          withheld.push({ kind: "quote", detail: `quotation ${ref} is not part of the directives asked about` });
          break;
        }
        const check = quoteIsVerbatim(quote.text, knowledge.corpusText);
        if (!check.verbatim) {
          withheld.push({ kind: "quote", detail: `quotation ${ref} failed corpus verification: ${check.reason}` });
          break;
        }
        blocks.push({
          type: "quote",
          ref,
          text: quote.text,
          label: quote.label,
          section: quote.section,
          pages: quote.pages,
          sourceUrl: `${knowledge.sourceUrl}#page=${quote.pages[0]}`,
          verified: "verbatim-in-retained-corpus",
        });
        break;
      }
      case "evidence": {
        const id = segment.ref ?? "";
        const record = knowledge.evidenceById.get(id);
        if (!record) {
          withheld.push({ kind: "evidence", detail: `unknown evidence record ${JSON.stringify(id)}` });
          break;
        }
        const link = record.directiveLinks.find((item) => factsById.has(item.directiveId));
        if (!link) {
          withheld.push({ kind: "evidence", detail: `evidence record ${id} is not linked to the directives asked about` });
          break;
        }
        blocks.push({
          type: "evidence",
          id: record.id,
          title: record.title,
          publisher: record.publisher,
          evidenceType: record.evidenceType,
          datedOn: record.datedOn,
          dateKind: record.dateKind,
          lastReviewedOn: record.lastReviewedOn,
          url: record.url,
          contextUrl: record.contextUrl,
          citation: link.excerpt,
          pages: link.locator.pages,
          limitations: record.limitations,
        });
        break;
      }
      case "empty-state": {
        const directiveId = segment.ref ?? "";
        const item = factsById.get(directiveId);
        if (!item) {
          withheld.push({ kind: "empty-state", detail: `empty state claimed for a directive not asked about: ${JSON.stringify(directiveId)}` });
          break;
        }
        if (item.coverage.evidenceCount > 0) {
          withheld.push({ kind: "empty-state", detail: `empty state claimed for ${directiveId}, which has ${item.coverage.evidenceCount} linked record(s)` });
          break;
        }
        if (emittedEmptyStates.has(directiveId)) break;
        emittedEmptyStates.add(directiveId);
        blocks.push(emptyStateBlock(item));
        break;
      }
      case "text": {
        const original = segment.text ?? "";
        if (original.trim() === "") break;
        let quotationFailure: string | null = null;
        for (const match of original.matchAll(QUOTED_SPAN)) {
          const check = quoteIsVerbatim(match[1], knowledge.corpusText);
          if (!check.verbatim) {
            quotationFailure = `"${match[1].slice(0, 60)}" is not verbatim in the retained corpus`;
            break;
          }
        }
        if (quotationFailure) {
          withheld.push({ kind: "text-quotation", detail: quotationFailure });
          break;
        }
        const { kept, withheld: verdictSentences } = withholdVerdictSentences(original);
        for (const sentence of verdictSentences) {
          withheld.push({ kind: "verdict", detail: sentence });
        }
        if (kept.trim() !== "") blocks.push({ type: "text", text: kept });
        break;
      }
      default:
        withheld.push({ kind: "unknown-segment", detail: String((segment as { kind: unknown }).kind) });
    }
  }

  // By construction, not by trust: every directive asked about with no linked
  // evidence gets the site's own empty state when evidence was in scope.
  if (fields.includes("evidence")) {
    for (const item of facts) {
      if (item.coverage.evidenceCount === 0 && !emittedEmptyStates.has(item.id)) {
        blocks.push(emptyStateBlock(item));
        emittedEmptyStates.add(item.id);
      }
    }
    blocks.push(freshnessBlock(facts));
  }

  return { blocks, withheld };
}

export function emptyStateBlock(item: DirectiveFacts): AnswerBlock {
  return {
    type: "empty-state",
    directiveId: item.id,
    label: item.label,
    statement: item.coverage.statement,
    lastCheckedOn: item.coverage.lastCheckedOn,
    nextReviewOn: item.coverage.nextReviewOn,
  };
}

export function freshnessBlock(facts: DirectiveFacts[]): AnswerBlock {
  return {
    type: "freshness",
    items: facts.map((item) => ({
      directiveId: item.id,
      label: item.label,
      evidence: item.evidence.map((record) => ({ id: record.id, lastReviewedOn: record.lastReviewedOn })),
      coverageState: item.coverage.state,
      sourcesLastCheckedOn: item.coverage.lastCheckedOn,
      nextReviewOn: item.coverage.nextReviewOn,
      statement: item.coverage.statement,
    })),
  };
}

/**
 * When the verifier withheld everything the model said, the record itself is
 * still an answer: the reviewed excerpt, the named bodies, and the timing,
 * rendered deterministically.
 */
export function recordFallback(facts: DirectiveFacts[], knowledge: Knowledge): AnswerBlock[] {
  const blocks: AnswerBlock[] = [
    { type: "text", text: "The model's narrative was withheld by the verifier. The record is shown directly instead." },
  ];
  for (const item of facts) {
    const quote = knowledge.quotes.get(item.excerptRef);
    if (quote) {
      blocks.push({
        type: "quote",
        ref: quote.ref,
        text: quote.text,
        label: quote.label,
        section: quote.section,
        pages: quote.pages,
        sourceUrl: `${knowledge.sourceUrl}#page=${quote.pages[0]}`,
        verified: "verbatim-in-retained-corpus",
      });
    }
    const bodies = [
      `Explicit lead: ${item.leadOrganizations.map((o) => o.name).join(", ") || "none"}.`,
      item.collaboratorOrganizations.length > 0 ? `Explicit collaborators: ${item.collaboratorOrganizations.map((o) => o.name).join(", ")}.` : "",
      item.mentionedOrganizations.length > 0 ? `Other named parties: ${item.mentionedOrganizations.map((o) => o.name).join(", ")}.` : "",
      item.timing.length > 0
        ? item.timing.map((t) => `Timing in the order: “${t.sourceText}” (applies to ${t.appliesTo}); calculated planning date ${t.derivedDate}, ${t.derivation}.`).join(" ")
        : "The order states no explicit completion deadline for this directive.",
    ].filter((line) => line !== "");
    blocks.push({ type: "text", text: `Directive ${item.label}, ${item.title}. ${bodies.join(" ")}` });
  }
  return blocks;
}
