import type { AskConfig } from "./config.ts";
import { defaultFields, type DirectiveFacts, type Knowledge } from "./knowledge.ts";
import { narrate } from "./narrate.ts";
import type { ModelProvider, Usage } from "./provider.ts";
import { NOTICE, refusalFor, type Pointer, type Refusal } from "./refusals.ts";
import { PROMPT_VERSION, type Field, type Narration, type StructuredQuestion } from "./schemas.ts";
import { preclassify, structureQuestion } from "./structure.ts";
import { recordFallback, verifyNarration, type AnswerBlock, type Withheld } from "./verify.ts";

/**
 * The pipeline: pre-classify, structure, look up, narrate, verify, label.
 *
 * A refusal is produced without a model call whenever the lexicon can decide,
 * and the model's own structuring is re-checked before anything is looked up.
 */

export interface Labels {
  aiGenerated: true;
  unofficial: true;
  notAComplianceDetermination: true;
  notice: string;
}

export interface Provenance {
  provider: string;
  model: string;
  promptVersion: string;
  commit: string;
  corpusSha256: string;
  generatedAt: string;
}

export interface AskResponse {
  kind: "answer" | "refusal";
  question: { intent: StructuredQuestion["intent"]; directiveIds: string[]; fields: Field[] };
  blocks: AnswerBlock[];
  refusal: Refusal | null;
  withheld: { count: number; items: Withheld[] };
  labels: Labels;
  provenance: Provenance;
  usage: Usage;
  modelCalls: number;
  /** Present only when ASK_DEBUG is set: the model's unverified output, for evaluation. */
  debug?: { rawNarration: Narration; factsDocument: string };
}

export interface AnswerDeps {
  knowledge: Knowledge;
  provider: ModelProvider;
  config: AskConfig;
  now?: () => Date;
}

export class QuestionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "QuestionError";
    this.status = status;
  }
}

const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

function addUsage(left: Usage, right: Usage): Usage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadInputTokens: left.cacheReadInputTokens + right.cacheReadInputTokens,
    cacheCreationInputTokens: left.cacheCreationInputTokens + right.cacheCreationInputTokens,
  };
}

function labels(): Labels {
  return { aiGenerated: true, unofficial: true, notAComplianceDetermination: true, notice: NOTICE };
}

function provenance(deps: AnswerDeps, model: string): Provenance {
  return {
    provider: deps.provider.name,
    model,
    promptVersion: PROMPT_VERSION,
    commit: deps.config.commit,
    corpusSha256: deps.knowledge.corpusSha256,
    generatedAt: (deps.now ?? (() => new Date()))().toISOString(),
  };
}

function pointersFor(directiveIds: string[], knowledge: Knowledge): Pointer[] {
  const pointers: Pointer[] = directiveIds
    .map((id) => knowledge.directiveById.get(id))
    .filter((directive): directive is NonNullable<typeof directive> => Boolean(directive))
    .map((directive) => ({ label: `Directive ${directive.label}: ${directive.title}`, href: `/directives/${directive.id}/` }));
  if (pointers.length === 0) {
    pointers.push({ label: "The directive register", href: "/" });
  }
  pointers.push({ label: "Reviewed public evidence and the sources checked", href: "/evidence/" });
  return pointers;
}

function refusalResponse(
  intent: Refusal["reason"],
  directiveIds: string[],
  fields: Field[],
  deps: AnswerDeps,
  usage: Usage,
  modelCalls: number,
  model: string,
): AskResponse {
  return {
    kind: "refusal",
    question: { intent, directiveIds, fields },
    blocks: [],
    refusal: refusalFor(intent, pointersFor(directiveIds, deps.knowledge)),
    withheld: { count: 0, items: [] },
    labels: labels(),
    provenance: provenance(deps, model),
    usage,
    modelCalls,
  };
}

export async function answerQuestion(
  input: { question: string; directiveId?: string },
  deps: AnswerDeps,
): Promise<AskResponse> {
  const question = input.question.trim();
  if (question === "") throw new QuestionError(400, "The question is empty.");
  if (question.length > deps.config.maxQuestionChars) {
    throw new QuestionError(413, `The question is longer than ${deps.config.maxQuestionChars} characters.`);
  }
  const hint = input.directiveId && deps.knowledge.directiveById.has(input.directiveId) ? input.directiveId : undefined;

  // Deterministic first: the most important refusals never depend on the model.
  const pre = preclassify(question, deps.knowledge, hint);
  if (pre.intent === "compliance-verdict") {
    return refusalResponse("compliance-verdict", hint ? [hint] : [], [], deps, ZERO_USAGE, 0, deps.provider.model);
  }
  if (pre.intent === "unknown-directive") {
    return refusalResponse("unknown-directive", [], [], deps, ZERO_USAGE, 0, deps.provider.model);
  }

  const structuring = await structureQuestion(question, deps.knowledge, deps.provider, {
    hint,
    maxTokens: 400,
  });
  let usage = structuring.usage;
  const structured = structuring.structured;

  if (structured.intent !== "directive-lookup" && structured.intent !== "evidence-lookup") {
    return refusalResponse(structured.intent, structured.directiveIds, structured.fields, deps, usage, 1, structuring.model);
  }

  const fields: Field[] = structured.fields.length > 0 ? structured.fields : defaultFields(structured.intent);
  if (structured.intent === "evidence-lookup" && !fields.includes("evidence")) fields.push("evidence");
  const facts: DirectiveFacts[] = structured.directiveIds.map((id) => deps.knowledge.factsFor(id));

  const narration = await narrate(question, facts, fields, deps.knowledge, deps.provider, {
    maxTokens: deps.config.maxOutputTokens,
  });
  usage = addUsage(usage, narration.usage);

  const verified = verifyNarration(narration.narration, facts, fields, deps.knowledge);
  const substantive = verified.blocks.filter((block) => block.type === "text" || block.type === "quote" || block.type === "evidence");
  const blocks = substantive.length === 0 ? [...recordFallback(facts, deps.knowledge), ...verified.blocks] : verified.blocks;

  return {
    kind: "answer",
    question: { intent: structured.intent, directiveIds: structured.directiveIds, fields },
    blocks,
    refusal: null,
    withheld: { count: verified.withheld.length, items: verified.withheld },
    labels: labels(),
    provenance: provenance(deps, narration.model),
    usage,
    modelCalls: 2,
    ...(deps.config.debug ? { debug: { rawNarration: narration.narration, factsDocument: narration.factsDocument } } : {}),
  };
}
