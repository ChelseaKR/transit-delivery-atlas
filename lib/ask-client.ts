/**
 * The page side of the question service.
 *
 * A client is constructed with an injectable fetch so a test can prove the
 * one property that matters most here: constructing the client (and rendering
 * the page around it) performs zero requests; only an explicit ask() does.
 * Every failure mode maps to a state the page can render without breaking.
 */

export const DEFAULT_ASK_ENDPOINT = "/api/ask";

export interface AskBlockText {
  type: "text";
  text: string;
}
export interface AskBlockQuote {
  type: "quote";
  ref: string;
  text: string;
  label: string;
  section: string;
  pages: number[];
  sourceUrl: string;
  verified: string;
}
export interface AskBlockEvidence {
  type: "evidence";
  id: string;
  title: string;
  publisher: string;
  evidenceType: string;
  datedOn: string;
  dateKind: string;
  lastReviewedOn: string;
  url: string;
  contextUrl: string;
  citation: string;
  pages: number[];
  limitations: string[];
}
export interface AskBlockEmptyState {
  type: "empty-state";
  directiveId: string;
  label: string;
  statement: string;
  lastCheckedOn: string | null;
  nextReviewOn: string;
}
export interface AskBlockFreshness {
  type: "freshness";
  items: Array<{
    directiveId: string;
    label: string;
    evidence: Array<{ id: string; lastReviewedOn: string }>;
    coverageState: string;
    sourcesLastCheckedOn: string | null;
    nextReviewOn: string;
    statement: string;
  }>;
}
export type AskBlock = AskBlockText | AskBlockQuote | AskBlockEvidence | AskBlockEmptyState | AskBlockFreshness;

export interface AskAnswer {
  kind: "answer" | "refusal";
  question: { intent: string; directiveIds: string[]; fields: string[] };
  blocks: AskBlock[];
  refusal: { reason: string; text: string; pointers: Array<{ label: string; href: string }> } | null;
  withheld: { count: number; items: Array<{ kind: string; detail: string }> };
  labels: { aiGenerated: boolean; unofficial: boolean; notAComplianceDetermination: boolean; notice: string };
  provenance: { provider: string; model: string; promptVersion: string; commit: string; generatedAt: string };
}

export type AskState =
  | { status: "answered"; answer: AskAnswer }
  | { status: "rate-limited"; message: string; retryAfterSeconds: number | null }
  | { status: "unavailable"; message: string }
  | { status: "invalid"; message: string }
  | { status: "failed"; message: string };

export interface AskClient {
  /** Requests made so far. Stays 0 until the reader explicitly asks. */
  requestCount(): number;
  ask(question: string, directiveId?: string): Promise<AskState>;
}

const NOT_DEPLOYED =
  "The question service is not deployed for this site. Everything on this page works without it; the record above is the complete Atlas entry for this directive.";
const UNREACHABLE =
  "The question service could not be reached. Everything on this page works without it.";

export function createAskClient(options: { endpoint?: string; fetchImpl?: typeof fetch } = {}): AskClient {
  const endpoint = options.endpoint ?? DEFAULT_ASK_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  let requests = 0;

  return {
    requestCount: () => requests,
    async ask(question: string, directiveId?: string): Promise<AskState> {
      requests += 1;
      if (!fetchImpl) return { status: "unavailable", message: UNREACHABLE };
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(directiveId ? { question, directiveId } : { question }),
        });
      } catch {
        return { status: "unavailable", message: UNREACHABLE };
      }
      if (response.status === 404) return { status: "unavailable", message: NOT_DEPLOYED };
      if (response.status === 429) {
        const body = await response.json().catch(() => null);
        return {
          status: "rate-limited",
          message: body?.message ?? "Too many questions for now; try again shortly. The page is complete without the service.",
          retryAfterSeconds: body?.retryAfterSeconds ?? null,
        };
      }
      if (response.status === 400 || response.status === 413) {
        const body = await response.json().catch(() => null);
        return { status: "invalid", message: body?.message ?? "The service could not accept that question." };
      }
      if (response.status === 503) {
        const body = await response.json().catch(() => null);
        return { status: "unavailable", message: body?.message ?? UNREACHABLE };
      }
      if (!response.ok) return { status: "failed", message: `The question service returned ${response.status}.` };
      const answer = (await response.json().catch(() => null)) as AskAnswer | null;
      if (!answer || !Array.isArray(answer.blocks) || !answer.labels?.aiGenerated) {
        return { status: "failed", message: "The question service returned something unexpected, so nothing is shown." };
      }
      return { status: "answered", answer };
    },
  };
}
