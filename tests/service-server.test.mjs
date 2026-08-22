import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../service/config.ts";
import { loadKnowledge } from "../service/knowledge.ts";
import { ProviderError } from "../service/provider.ts";
import { RateLimiter } from "../service/ratelimit.ts";
import { createAskServer } from "../service/server.ts";

const knowledge = await loadKnowledge();

test("config reads limits from the environment and never carries a credential", () => {
  const config = loadConfig({ ASK_PROVIDER: "bedrock", ASK_RATE_PER_MINUTE: "3", ANTHROPIC_API_KEY: "sk-should-not-appear" });
  assert.equal(config.provider, "bedrock");
  assert.equal(config.model, "global.anthropic.claude-sonnet-4-6");
  assert.equal(config.ratePerMinute, 3);
  assert.equal(loadConfig({}).model, "claude-sonnet-5");
  assert.ok(!JSON.stringify(config).includes("sk-should-not-appear"));
  assert.throws(() => loadConfig({ ASK_PROVIDER: "openai" }), /ASK_PROVIDER/);
  assert.throws(() => loadConfig({ ASK_DAILY_CAP: "0" }), /positive integer/);
});

test("the rate limiter enforces a per-client rate, a per-client daily cap, and a global daily cap", () => {
  const limiter = new RateLimiter({ ratePerMinute: 2, clientDailyCap: 3, dailyCap: 5 });
  const t0 = Date.parse("2026-08-21T10:00:00Z");
  assert.equal(limiter.take("a", t0).allowed, true);
  assert.equal(limiter.take("a", t0).allowed, true);
  const third = limiter.take("a", t0);
  assert.equal(third.allowed, false);
  assert.equal(third.reason, "client-rate");
  assert.ok(third.retryAfterSeconds >= 1);
  // Refill after a minute, then the daily cap takes over.
  assert.equal(limiter.take("a", t0 + 60_000).allowed, true);
  const daily = limiter.take("a", t0 + 120_000);
  assert.equal(daily.allowed, false);
  assert.equal(daily.reason, "client-daily");
  // Another client is still fine until the global cap.
  assert.equal(limiter.take("b", t0).allowed, true);
  assert.equal(limiter.take("b", t0).allowed, true);
  assert.equal(limiter.take("c", t0 + 60_000).reason, "global-daily");
  assert.deepEqual(limiter.snapshot(), { day: "2026-08-21", requestsToday: 5, clientsToday: 2 });
  // A new day resets everything.
  assert.equal(limiter.take("c", t0 + 86_400_000).allowed, true);
});

async function startServer({ provider, config = loadConfig({ ASK_RATE_PER_MINUTE: "2", ASK_CLIENT_DAILY_CAP: "3", ASK_DAILY_CAP: "10", ASK_ALLOWED_ORIGIN: "https://transit.chelseakr.com" }) }) {
  const logs = [];
  const server = createAskServer({
    config,
    knowledge,
    provider,
    limiter: new RateLimiter(config),
    log: (event) => logs.push(event),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    logs,
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const scriptedProvider = {
  name: "anthropic",
  model: "scripted-model",
  calls: 0,
  async complete() {
    this.calls += 1;
    const usage = { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
    if (this.calls % 2 === 1) {
      return { parsed: { intent: "directive-lookup", directiveIds: ["n-7-26-1a"], fields: ["source-language"], rationale: "" }, usage, model: "scripted-model" };
    }
    return { parsed: { segments: [{ kind: "quote", ref: "quote:n-7-26-1a", text: null }] }, usage, model: "scripted-model" };
  },
};

test("POST /api/ask answers, labels, and logs counts but never the question", async () => {
  const { base, logs, close } = await startServer({ provider: scriptedProvider });
  try {
    const secret = "ZEBRA-QUESTION-TEXT-THAT-MUST-NOT-BE-LOGGED";
    const response = await fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://transit.chelseakr.com" },
      body: JSON.stringify({ question: `What does 1(a) say? ${secret}` }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://transit.chelseakr.com");
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.kind, "answer");
    assert.equal(body.labels.aiGenerated, true);
    assert.equal(body.labels.unofficial, true);
    assert.equal(body.labels.notAComplianceDetermination, true);
    assert.match(body.labels.notice, /not an official State of California website/);
    assert.ok(body.blocks.some((block) => block.type === "quote"));
    assert.ok(!JSON.stringify(logs).includes(secret), "question text must never be logged");
    assert.equal(logs.at(-1).status, 200);
    assert.equal(logs.at(-1).intent, "directive-lookup");
  } finally {
    await close();
  }
});

test("a verdict question over HTTP is refused with 200 and no provider call", async () => {
  const before = scriptedProvider.calls;
  const { base, close } = await startServer({ provider: scriptedProvider });
  try {
    const response = await fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Is Caltrans on track with 1(a)?", directiveId: "n-7-26-1a" }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.kind, "refusal");
    assert.equal(body.refusal.reason, "compliance-verdict");
    assert.equal(scriptedProvider.calls, before);
  } finally {
    await close();
  }
});

test("429 carries Retry-After and a message that leaves the page intact", async () => {
  const { base, close } = await startServer({ provider: scriptedProvider });
  try {
    const ask = () =>
      fetch(`${base}/api/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "Who leads directive 4?" }),
      });
    await ask();
    await ask();
    const limited = await ask();
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) >= 1);
    const body = await limited.json();
    assert.equal(body.error, "rate-limited");
    assert.match(body.message, /complete without the service/);
  } finally {
    await close();
  }
});

test("bad input and provider failure return JSON the page can show", async () => {
  const failing = {
    name: "anthropic",
    model: "failing-model",
    async complete() {
      throw new ProviderError("connection", "no network", true);
    },
  };
  const { base, logs, close } = await startServer({
    provider: failing,
    config: loadConfig({ ASK_RATE_PER_MINUTE: "100", ASK_CLIENT_DAILY_CAP: "100", ASK_DAILY_CAP: "100" }),
  });
  try {
    const empty = await fetch(`${base}/api/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(empty.status, 400);
    const notJson = await fetch(`${base}/api/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: "not json" });
    assert.equal(notJson.status, 400);
    const tooLong = await fetch(`${base}/api/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "x".repeat(700) }) });
    assert.equal(tooLong.status, 413);
    const down = await fetch(`${base}/api/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "Who leads directive 4?" }) });
    assert.equal(down.status, 503);
    const body = await down.json();
    assert.equal(body.error, "provider-unavailable");
    assert.equal(body.reason, "connection");
    assert.equal(down.headers.get("retry-after"), "30");
    assert.equal(logs.at(-1).providerError, "connection");
    const missing = await fetch(`${base}/api/other`);
    assert.equal(missing.status, 404);
  } finally {
    await close();
  }
});

test("GET /api/ask/health reports provenance and limits without secrets", async () => {
  const { base, close } = await startServer({ provider: scriptedProvider });
  try {
    const response = await fetch(`${base}/api/ask/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.model, "scripted-model");
    assert.equal(body.corpusSha256, knowledge.corpusSha256);
    assert.equal(body.limits.ratePerMinute, 2);
    assert.ok(!("apiKey" in body));
  } finally {
    await close();
  }
});

test("a cross-origin request from an unlisted origin gets no CORS grant", async () => {
  const { base, close } = await startServer({ provider: scriptedProvider });
  try {
    const response = await fetch(`${base}/api/ask/health`, { headers: { origin: "https://evil.example" } });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  } finally {
    await close();
  }
});
