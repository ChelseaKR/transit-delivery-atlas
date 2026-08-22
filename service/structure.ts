import { asksForVerdict } from "../lib/verdict-language.mjs";
import { directiveIndex, type Knowledge } from "./knowledge.ts";
import type { ModelProvider } from "./provider.ts";
import { PROMPT_VERSION, StructuredQuestionSchema, type StructuredQuestion } from "./schemas.ts";

/**
 * Step one: turn a question into a typed lookup.
 *
 * A deterministic pre-classifier runs first and last. The model is asked only
 * when the question is not already a verdict request, and its answer is
 * re-checked: directive IDs must resolve, a verdict intent from the model is
 * honoured, and a verdict the model missed is still caught by the lexicon.
 */

// A number, optionally followed by a parenthesised letter ("1(a)", "3 (b)") or
// an attached letter ("1a"). A space-separated letter is not a sub-item, so
// "directive 4 and" does not read as 4(a). A digit or decimal after the number
// ("5307", "4.2") is not a directive reference.
const DIRECTIVE_REFERENCE = /\b(?:(directives?|sections?|orders?|items?|paragraphs?|§)\s*)?([1-9])(?:\s*\(\s*([a-z])\s*\)|([a-z])(?![a-z]))?(?!\d|\.\d)/gi;
const VALID_SUBITEMS: Record<string, string> = { "1": "abcdefg", "3": "abcdefghij" };

export interface Preclassification {
  intent: "compliance-verdict" | "unknown-directive" | null;
  directiveIds: string[];
  unknownReferences: string[];
}

/**
 * Deterministic reading of the question: verdict language and explicit
 * directive references. Runs before any model call so the most important
 * refusals never depend on the model.
 */
export function preclassify(question: string, knowledge: Knowledge, hint?: string): Preclassification {
  if (asksForVerdict(question)) {
    return { intent: "compliance-verdict", directiveIds: [], unknownReferences: [] };
  }
  const directiveIds = new Set<string>();
  const unknownReferences: string[] = [];
  for (const match of question.matchAll(DIRECTIVE_REFERENCE)) {
    const [, labelWord, number, parenLetter, attachedLetter] = match;
    const letter = parenLetter ?? attachedLetter;
    const hasLabelWord = Boolean(labelWord);
    // A bare digit ("within 120 days", "Section 5307") is not a directive
    // reference unless it carries a letter or a label word.
    if (!letter && !hasLabelWord) continue;
    const label = letter ? `${number}(${letter.toLowerCase()})` : number;
    const resolved = knowledge.resolveDirective(label);
    if (resolved) directiveIds.add(resolved.id);
    else if (!letter && (number === "1" || number === "3")) continue; // "Section 1" alone is a family, resolved by the model
    else if (letter && (VALID_SUBITEMS[number] ?? "").includes(letter.toLowerCase())) continue; // unreachable once resolve succeeds; kept for clarity
    else unknownReferences.push(label);
  }
  if (hint) {
    const resolved = knowledge.resolveDirective(hint);
    if (resolved && directiveIds.size === 0) directiveIds.add(resolved.id);
  }
  if (unknownReferences.length > 0 && directiveIds.size === 0) {
    return { intent: "unknown-directive", directiveIds: [], unknownReferences };
  }
  return { intent: null, directiveIds: [...directiveIds], unknownReferences };
}

export function structuringSystemPrompt(knowledge: Knowledge): string[] {
  return [
    `You classify questions about California Executive Order N-7-26 for an independent, unofficial crosswalk called Transit Delivery Atlas. Prompt version ${PROMPT_VERSION}.

Your only job is to turn the question into a typed lookup. You do not answer it.

Intents:
- "directive-lookup": the reader wants what the order says, which bodies it names, or what timing it states, for one or more directives.
- "evidence-lookup": the reader wants to know what reviewed public evidence the Atlas links to one or more directives, or when the Atlas last checked.
- "compliance-verdict": the reader asks, in any phrasing, whether a body is complying, on track, late, done, performing, grading, or likely to meet a date. Classify as this even when the question also asks something answerable. Never soften it.
- "out-of-scope": general transit policy, funding politics, other executive orders, legislation, opinions, predictions, or anything the crosswalk does not record.
- "unknown-directive": the reader names a directive, section, or item that does not exist in the order (the actionable directives are 1(a)-1(g), 2, 3(a)-3(j), 4, 5, 6).
- "too-vague": you cannot tell which directive or subject is meant and no body is named.

Fields: "source-language", "responsible-bodies", "timing", "evidence", "open-questions", "analysis-summary". Choose the fields the question actually asks for. "timing" covers deadlines, dates, and "by when". "responsible-bodies" covers who is named, responsible, lead, or directed.

directiveIds must be IDs from the index below, at most seven. A question about a body (for example "what must Caltrans do") maps to the directives that name that body as lead; if more than seven, choose the seven whose titles best match the subject. A question about a subject (fare payment, dashboards, CEQA, NEPA, toll revenue, MUTCD, prohousing, airspace, real property, active transportation, data guidelines) maps to the directives whose titles or excerpts cover it.

Return a short rationale (one sentence).`,
    `Directive index (id | label | title | lead | timing | evidence records):\n${directiveIndex(knowledge)}`,
  ];
}

export interface StructuringResult {
  structured: StructuredQuestion;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number };
}

export async function structureQuestion(
  question: string,
  knowledge: Knowledge,
  provider: ModelProvider,
  options: { hint?: string; maxTokens: number },
): Promise<StructuringResult> {
  const user = options.hint
    ? `The reader is on the page for directive ${options.hint}. Question: ${question}`
    : `Question: ${question}`;
  const result = await provider.complete({
    system: structuringSystemPrompt(knowledge),
    user,
    schema: StructuredQuestionSchema,
    maxTokens: options.maxTokens,
  });
  return { structured: finalize(result.parsed, question, knowledge, options.hint), model: result.model, usage: result.usage };
}

/**
 * Post-validate the model's structuring. The lexicon has the last word on
 * verdicts; directive IDs must resolve; an in-scope lookup with nothing to look
 * up is too vague.
 */
export function finalize(
  structured: StructuredQuestion,
  question: string,
  knowledge: Knowledge,
  hint?: string,
): StructuredQuestion {
  if (asksForVerdict(question) || structured.intent === "compliance-verdict") {
    return { ...structured, intent: "compliance-verdict", directiveIds: resolveAll(structured.directiveIds, knowledge) };
  }
  const resolved = resolveAll(structured.directiveIds, knowledge);
  const unresolved = structured.directiveIds.filter((id) => !knowledge.resolveDirective(id));
  if (structured.intent === "unknown-directive" || (unresolved.length > 0 && resolved.length === 0)) {
    return { ...structured, intent: "unknown-directive", directiveIds: [] };
  }
  if (structured.intent === "directive-lookup" || structured.intent === "evidence-lookup") {
    let ids = resolved;
    if (ids.length === 0 && hint) {
      const fromHint = knowledge.resolveDirective(hint);
      if (fromHint) ids = [fromHint.id];
    }
    if (ids.length === 0) {
      return { ...structured, intent: "too-vague", directiveIds: [] };
    }
    return { ...structured, directiveIds: ids.slice(0, 7) };
  }
  return { ...structured, directiveIds: resolved };
}

function resolveAll(ids: string[], knowledge: Knowledge): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const directive = knowledge.resolveDirective(id);
    if (directive && !out.includes(directive.id)) out.push(directive.id);
  }
  return out;
}
