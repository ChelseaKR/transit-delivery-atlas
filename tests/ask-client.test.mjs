import assert from "node:assert/strict";
import test from "node:test";
import { createAskClient, DEFAULT_ASK_ENDPOINT } from "../lib/ask-client.ts";

/**
 * The opt-in property, proven at the module that owns the network call:
 * constructing the client performs zero requests; only ask() does, once.
 */

function fakeFetch(status, body) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
  return { calls, impl };
}

const answer = {
  kind: "answer",
  question: { intent: "directive-lookup", directiveIds: ["n-7-26-1a"], fields: [] },
  blocks: [{ type: "text", text: "ok" }],
  refusal: null,
  withheld: { count: 0, items: [] },
  labels: { aiGenerated: true, unofficial: true, notAComplianceDetermination: true, notice: "n" },
  provenance: { provider: "anthropic", model: "m", promptVersion: "v", commit: "c", generatedAt: "2026-08-21T00:00:00Z" },
};

test("constructing a client performs no request; ask() performs exactly one", async () => {
  const { calls, impl } = fakeFetch(200, answer);
  const client = createAskClient({ fetchImpl: impl });
  assert.equal(client.requestCount(), 0);
  assert.equal(calls.length, 0, "zero requests before the reader asks");
  const state = await client.ask("What does 1(a) require?", "n-7-26-1a");
  assert.equal(calls.length, 1);
  assert.equal(client.requestCount(), 1);
  assert.equal(calls[0].url, DEFAULT_ASK_ENDPOINT);
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { question: "What does 1(a) require?", directiveId: "n-7-26-1a" });
  assert.equal(state.status, "answered");
  assert.equal(state.answer.blocks[0].text, "ok");
});

test("the default endpoint is same-origin relative, so no off-origin request can happen without configuration", () => {
  assert.equal(DEFAULT_ASK_ENDPOINT, "/api/ask");
  assert.ok(!DEFAULT_ASK_ENDPOINT.includes("//"), "a relative path cannot name another origin");
});

test("404 means not deployed, and the message says the page is complete without it", async () => {
  const { impl } = fakeFetch(404, { error: "not-found" });
  const state = await createAskClient({ fetchImpl: impl }).ask("q");
  assert.equal(state.status, "unavailable");
  assert.match(state.message, /not deployed/);
  assert.match(state.message, /works without it/);
});

test("429 carries the service's message and retry seconds", async () => {
  const { impl } = fakeFetch(429, { message: "Too many questions.", retryAfterSeconds: 42 });
  const state = await createAskClient({ fetchImpl: impl }).ask("q");
  assert.equal(state.status, "rate-limited");
  assert.equal(state.retryAfterSeconds, 42);
  assert.equal(state.message, "Too many questions.");
});

test("400/413, 503, network failure, and a malformed body each map to a renderable state", async () => {
  const bad = await createAskClient({ fetchImpl: fakeFetch(400, { message: "Bad." }).impl }).ask("q");
  assert.equal(bad.status, "invalid");
  const tooLong = await createAskClient({ fetchImpl: fakeFetch(413, { message: "Long." }).impl }).ask("q");
  assert.equal(tooLong.status, "invalid");
  const down = await createAskClient({ fetchImpl: fakeFetch(503, { message: "Down." }).impl }).ask("q");
  assert.equal(down.status, "unavailable");
  const network = await createAskClient({
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  }).ask("q");
  assert.equal(network.status, "unavailable");
  const weird = await createAskClient({ fetchImpl: fakeFetch(200, { nonsense: true }).impl }).ask("q");
  assert.equal(weird.status, "failed");
  assert.match(weird.message, /nothing is shown/);
  const server = await createAskClient({ fetchImpl: fakeFetch(500, {}).impl }).ask("q");
  assert.equal(server.status, "failed");
});

test("a response without the AI-generated label is rejected rather than rendered", async () => {
  const unlabeled = { ...answer, labels: { ...answer.labels, aiGenerated: false } };
  const state = await createAskClient({ fetchImpl: fakeFetch(200, unlabeled).impl }).ask("q");
  assert.equal(state.status, "failed");
});
