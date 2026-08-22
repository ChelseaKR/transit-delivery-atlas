import { z } from "zod";

/**
 * The two structured contracts the model is held to. Everything the model
 * returns is parsed against these; anything that does not parse is treated as
 * a provider failure, not as an answer.
 */

export const PROMPT_VERSION = "2026-08-21.1";

/** What kind of question this is. Only the first two ever reach the narrator. */
export const IntentSchema = z.enum([
  "directive-lookup",
  "evidence-lookup",
  "compliance-verdict",
  "out-of-scope",
  "unknown-directive",
  "too-vague",
]);
export type Intent = z.infer<typeof IntentSchema>;

export const FieldSchema = z.enum([
  "source-language",
  "responsible-bodies",
  "timing",
  "evidence",
  "open-questions",
  "analysis-summary",
]);
export type Field = z.infer<typeof FieldSchema>;

export const StructuredQuestionSchema = z.object({
  intent: IntentSchema,
  directiveIds: z.array(z.string()),
  fields: z.array(FieldSchema),
  rationale: z.string(),
});
export type StructuredQuestion = z.infer<typeof StructuredQuestionSchema>;

/**
 * A narration is a list of segments. A quotation or an evidence record is
 * referred to by ID and substituted by the service, so the model cannot
 * misquote the order or invent a record. Free text is verified before display.
 */
export const SegmentKindSchema = z.enum(["text", "quote", "evidence", "empty-state"]);

export const SegmentSchema = z.object({
  kind: SegmentKindSchema,
  text: z.string().nullable(),
  ref: z.string().nullable(),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const NarrationSchema = z.object({
  segments: z.array(SegmentSchema),
});
export type Narration = z.infer<typeof NarrationSchema>;

/** The request body the server accepts. */
export const AskRequestSchema = z.object({
  question: z.string().min(1),
  directiveId: z.string().optional(),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;
