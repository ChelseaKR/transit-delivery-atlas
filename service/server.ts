import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { answerQuestion, QuestionError, type AnswerDeps } from "./answer.ts";
import { loadConfig, type AskConfig } from "./config.ts";
import { loadKnowledge } from "./knowledge.ts";
import { createProvider, ProviderError, type ModelProvider } from "./provider.ts";
import { RateLimiter } from "./ratelimit.ts";
import { AskRequestSchema, PROMPT_VERSION } from "./schemas.ts";

/**
 * A small HTTP surface: POST /api/ask and GET /api/ask/health.
 *
 * Logs carry counts and outcomes, never question text. A limited, failed, or
 * refused request returns a JSON body the page can show without breaking.
 */

const MAX_BODY_BYTES = 8 * 1024;

export interface ServerDeps {
  config: AskConfig;
  knowledge: Awaited<ReturnType<typeof loadKnowledge>>;
  provider: ModelProvider;
  limiter: RateLimiter;
  log?: (event: Record<string, unknown>) => void;
}

function json(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers,
  });
  response.end(payload);
}

function corsHeaders(request: IncomingMessage, config: AskConfig): Record<string, string> {
  const origin = request.headers.origin;
  if (!config.allowedOrigin || !origin || origin !== config.allowedOrigin) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "origin",
  };
}

export function clientKey(request: IncomingMessage, config: AskConfig): string {
  if (config.trustProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.socket.remoteAddress ?? "unknown";
}

async function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new QuestionError(413, "The request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

export function createAskServer(deps: ServerDeps) {
  const log = deps.log ?? ((event) => console.log(JSON.stringify(event)));
  const answerDeps: AnswerDeps = { knowledge: deps.knowledge, provider: deps.provider, config: deps.config };

  return createServer(async (request, response) => {
    const started = Date.now();
    const cors = corsHeaders(request, deps.config);
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "OPTIONS") {
      response.writeHead(204, cors);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/ask/health") {
      json(
        response,
        200,
        {
          ok: true,
          provider: deps.provider.name,
          model: deps.provider.model,
          promptVersion: PROMPT_VERSION,
          commit: deps.config.commit,
          corpusSha256: deps.knowledge.corpusSha256,
          limits: {
            ratePerMinute: deps.config.ratePerMinute,
            clientDailyCap: deps.config.clientDailyCap,
            dailyCap: deps.config.dailyCap,
            ...deps.limiter.snapshot(),
          },
        },
        cors,
      );
      return;
    }

    if (request.method !== "POST" || url.pathname !== "/api/ask") {
      json(response, 404, { error: "not-found", message: "Not found." }, cors);
      return;
    }

    const decision = deps.limiter.take(clientKey(request, deps.config));
    if (!decision.allowed) {
      log({ event: "ask", status: 429, reason: decision.reason, durationMs: Date.now() - started });
      json(
        response,
        429,
        {
          error: "rate-limited",
          reason: decision.reason,
          message:
            decision.reason === "global-daily"
              ? "The question service has reached its daily cap. The directive record on this page is complete without it; try again tomorrow."
              : "Too many questions from this connection for now. The directive record on this page is complete without the service; try again shortly.",
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        { ...cors, "retry-after": String(decision.retryAfterSeconds ?? 60) },
      );
      return;
    }

    try {
      const body = await readBody(request);
      const parsed = AskRequestSchema.safeParse(JSON.parse(body || "{}"));
      if (!parsed.success) throw new QuestionError(400, "The request must be JSON with a non-empty \"question\" string.");
      const result = await answerQuestion(parsed.data, answerDeps);
      log({
        event: "ask",
        status: 200,
        kind: result.kind,
        intent: result.question.intent,
        directives: result.question.directiveIds.length,
        withheld: result.withheld.count,
        modelCalls: result.modelCalls,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadInputTokens: result.usage.cacheReadInputTokens,
        durationMs: Date.now() - started,
      });
      json(response, 200, result, cors);
    } catch (error) {
      if (error instanceof SyntaxError) {
        json(response, 400, { error: "bad-request", message: "The request body is not valid JSON." }, cors);
        return;
      }
      if (error instanceof QuestionError) {
        log({ event: "ask", status: error.status, durationMs: Date.now() - started });
        json(response, error.status, { error: "bad-request", message: error.message }, cors);
        return;
      }
      if (error instanceof ProviderError) {
        log({ event: "ask", status: 503, providerError: error.kind, durationMs: Date.now() - started });
        json(
          response,
          503,
          {
            error: "provider-unavailable",
            reason: error.kind,
            message: "The question service could not get an answer from its model provider. The directive record on this page is complete without it.",
          },
          { ...cors, "retry-after": error.retryable ? "30" : "600" },
        );
        return;
      }
      log({ event: "ask", status: 500, durationMs: Date.now() - started });
      json(response, 500, { error: "internal", message: "The question service hit an internal error." }, cors);
    }
  });
}

export async function main(): Promise<void> {
  const config = loadConfig();
  const knowledge = await loadKnowledge();
  const provider = createProvider(config);
  const limiter = new RateLimiter(config);
  const server = createAskServer({ config, knowledge, provider, limiter });
  server.listen(config.port, () => {
    console.log(
      JSON.stringify({
        event: "listening",
        port: config.port,
        provider: config.provider,
        model: config.model,
        promptVersion: PROMPT_VERSION,
        commit: config.commit,
      }),
    );
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
