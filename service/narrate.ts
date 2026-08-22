import type { DirectiveFacts, Knowledge } from "./knowledge.ts";
import type { ModelProvider } from "./provider.ts";
import { NarrationSchema, PROMPT_VERSION, type Field, type Narration } from "./schemas.ts";

/**
 * Step two: narrate facts the service assembled.
 *
 * The model sees the facts document below and nothing else about the order.
 * It may quote the order only by emitting a "quote" segment whose ref is one of
 * the listed quotation IDs, may cite evidence only by emitting an "evidence"
 * segment with a listed record ID, and must emit an "empty-state" segment for a
 * directive the facts mark as having no linked evidence. Free text is allowed
 * for connective narration and is verified before display.
 */

export function narrationSystemPrompt(): string[] {
  return [
    `You narrate records from Transit Delivery Atlas, an independent, unofficial crosswalk of California Executive Order N-7-26. Prompt version ${PROMPT_VERSION}.

You are given a FACTS document assembled by the service from reviewed data. Answer the reader's question using only the facts. Output a list of segments.

Segment kinds:
- {"kind":"quote","ref":"<quotation id>","text":null}: inserts the exact reviewed excerpt of the order. Use this whenever you convey what the order says. Never paraphrase the order in your own words as if it were a quotation, and never put the order's words inside a text segment.
- {"kind":"evidence","ref":"<evidence record id>","text":null}: inserts a reviewed evidence record with its date, publisher, review date, and limitations. Use it for every evidence record you mention.
- {"kind":"empty-state","ref":"<directive id>","text":null}: inserts the Atlas's own statement that no reviewed evidence is linked to that directive, with when the listed sources were last checked. You must emit this for every directive whose facts say evidenceCount is 0 whenever the question concerns evidence, and you must not describe that absence in your own words.
- {"kind":"text","ref":null,"text":"..."}: short connective prose in complete sentences. Each text segment must stand on its own; never end a text segment mid-sentence expecting the next segment to finish it. A sentence that introduces a quotation ends with a colon, for example "Directive 1(a) directs Caltrans to:" followed by the quote segment. The directive's title is an editorial label, not the order's words: name it without quotation marks, or leave it out. Name bodies exactly as the facts name them. Give timing as the facts give it: the order's own words plus the calculated planning date and its derivation, described as a "calculated planning date", never as a deadline that was met or missed. Do not put quotation marks around anything except the order's exact words, and prefer a quote segment to quoting inline.

Rules that are enforced after you answer, so follow them:
- Never state or imply whether a body has complied, acted, made progress, is on track, is late, or will meet a date. Not even to say that nothing has happened. Absence of linked evidence is not evidence of absence.
- Never add facts that are not in the FACTS document. If the facts do not answer part of the question, say in one sentence that the Atlas does not record it.
- Analytical summaries and open questions are labelled interpretation; if you use them, say "the Atlas's analysis" and do not present them as the order's text.
- Keep it brief: a few text segments, the quotes and records that answer the question, and nothing else. No greetings, no sign-off, no disclaimers (the service adds those).`,
  ];
}

const FIELD_NOTES: Record<Field, string> = {
  "source-language": "what the order says (use quote segments)",
  "responsible-bodies": "the bodies the order explicitly names, by role",
  timing: "the timing the order states and the calculated planning date with its derivation",
  evidence: "the reviewed public evidence linked, or the empty state, with review dates",
  "open-questions": "the Atlas's open implementation questions (interpretation)",
  "analysis-summary": "the Atlas's interpretive summary (interpretation)",
};

/** The facts document: plain text the narrator reads, generated, never hand-written. */
export function factsDocument(facts: DirectiveFacts[], fields: Field[], knowledge: Knowledge): string {
  const lines: string[] = [];
  lines.push(`FIELDS REQUESTED: ${fields.map((field) => `${field} (${FIELD_NOTES[field]})`).join("; ")}`);
  lines.push(`Evidence collection last swept ${knowledge.evidenceScope.lastUpdatedOn}; next planned sweep ${knowledge.evidenceScope.nextReviewOn}.`);
  for (const directive of facts) {
    lines.push("");
    lines.push(`DIRECTIVE ${directive.id} — label ${directive.label} — "${directive.title}" (editorial title) — order section ${directive.section}, PDF page(s) ${directive.pages.join(", ")} — source excerpt reviewed ${directive.lastReviewedOn}`);
    lines.push(`  quotation ids: ${[directive.excerptRef, ...directive.contextRefs].join(", ")}`);
    const excerpt = knowledge.quotes.get(directive.excerptRef);
    if (excerpt) lines.push(`  ${directive.excerptRef}: "${excerpt.text}"`);
    for (const ref of directive.contextRefs) {
      const context = knowledge.quotes.get(ref);
      if (context) lines.push(`  ${ref} (${context.label}): "${context.text}"`);
    }
    if (directive.qualifiers.length > 0) {
      lines.push(`  qualifiers preserved from the source: ${directive.qualifiers.map((q) => `"${q.text}" applies to ${q.appliesTo}`).join("; ")}`);
    }
    for (const note of directive.sourceNotes) lines.push(`  transcription note: ${note}`);
    lines.push(`  explicit lead: ${directive.leadOrganizations.map((o) => `${o.name} (${o.shortName})`).join("; ") || "none"}`);
    lines.push(`  explicit collaborators: ${directive.collaboratorOrganizations.map((o) => `${o.name} (${o.shortName})`).join("; ") || "none"}`);
    lines.push(`  other named parties: ${directive.mentionedOrganizations.map((o) => `${o.name} (${o.shortName})`).join("; ") || "none"}`);
    if (directive.timing.length > 0) {
      for (const timing of directive.timing) {
        lines.push(`  timing: order says "${timing.sourceText}" (applies to ${timing.appliesTo}); calculated planning date ${timing.derivedDate}, derivation: ${timing.derivation}`);
      }
    } else {
      lines.push("  timing: the order states no explicit completion deadline for this directive");
    }
    if (fields.includes("evidence")) {
      lines.push(`  evidenceCount: ${directive.coverage.evidenceCount}; coverage state: ${directive.coverage.state}`);
      for (const record of directive.evidence) {
        const link = record.directiveLinks.find((item) => item.directiveId === directive.id);
        lines.push(`  evidence record ${record.id}: "${record.title}" — ${record.publisher} — ${record.evidenceType} — dated ${record.datedOn} (${record.dateKind}) — Atlas last reviewed ${record.lastReviewedOn} — explicit citation: "${link?.excerpt ?? ""}" — summary: ${record.editorialSummary}`);
        for (const limitation of record.limitations) lines.push(`    limitation: ${limitation}`);
      }
      if (directive.coverage.evidenceCount === 0) {
        lines.push(`  NO LINKED EVIDENCE: emit an empty-state segment with ref "${directive.id}". Do not describe the absence yourself.`);
      }
    }
    if (fields.includes("analysis-summary")) lines.push(`  Atlas analysis (interpretation): ${directive.analysisSummary}`);
    if (fields.includes("open-questions")) {
      lines.push(`  Atlas open implementation questions (interpretation): ${directive.openQuestions.join(" | ")}`);
    }
  }
  return lines.join("\n");
}

export interface NarrationResult {
  narration: Narration;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number };
  factsDocument: string;
}

export async function narrate(
  question: string,
  facts: DirectiveFacts[],
  fields: Field[],
  knowledge: Knowledge,
  provider: ModelProvider,
  options: { maxTokens: number },
): Promise<NarrationResult> {
  const document = factsDocument(facts, fields, knowledge);
  const result = await provider.complete({
    system: narrationSystemPrompt(),
    user: `FACTS:\n${document}\n\nQUESTION: ${question}`,
    schema: NarrationSchema,
    maxTokens: options.maxTokens,
  });
  return { narration: result.parsed, model: result.model, usage: result.usage, factsDocument: document };
}
