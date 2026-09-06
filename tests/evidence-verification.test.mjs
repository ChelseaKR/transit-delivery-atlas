import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CannotVerify,
  draftLimitation,
  failures,
  report,
  verifyEvidence,
} from "../lib/evidence-verification.mjs";
import { verdictPatternIn, splitSentences } from "../lib/verdict-language.mjs";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const REVIEWED_BYTES = new TextEncoder().encode("the artifact as reviewed");
const REVIEWED_SHA256 = createHash("sha256").update(REVIEWED_BYTES).digest("hex");
const ARTIFACT_URL = "https://example.gov/artifact.pdf";
const CONTEXT_URL = "https://example.gov/index";

const record = (overrides = {}) => ({
  id: "example-record",
  url: ARTIFACT_URL,
  contextUrl: CONTEXT_URL,
  sha256: REVIEWED_SHA256,
  mediaType: "application/pdf",
  ...overrides,
});

/**
 * A fetch stub. `responses` maps a URL to `{status, url, body, contentType}` or
 * to an Error, which is thrown the way a transport failure throws.
 */
function stubFetch(responses) {
  return async (url) => {
    const planned = responses[url];
    if (planned === undefined) throw new Error(`unexpected request for ${url}`);
    if (planned instanceof Error) throw planned;
    const body = planned.body ?? REVIEWED_BYTES;
    return {
      url: planned.url ?? url,
      status: planned.status ?? 200,
      headers: { get: () => planned.contentType ?? "application/pdf" },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };
}

const reachable = {
  [ARTIFACT_URL]: {},
  [CONTEXT_URL]: { contentType: "text/html; charset=utf-8" },
};

test("an artifact whose live bytes hash to the stored hash is intact", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch(reachable),
  });
  assert.equal(log.records[0].artifact.outcome, "intact");
  assert.equal(log.records[0].artifact.observedSha256, REVIEWED_SHA256);
  assert.equal(log.records[0].checkedOn, "2026-09-06");
  assert.deepEqual(failures(log), []);
});

test("flipping the stored hash yields changed, and names both hashes", async () => {
  const stale = record({ sha256: "0".repeat(64) });
  const log = await verifyEvidence({
    records: [stale],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch(reachable),
  });
  assert.equal(log.records[0].artifact.outcome, "changed");
  assert.match(log.records[0].artifact.detail, new RegExp(REVIEWED_SHA256));
  assert.match(log.records[0].artifact.detail, /0{64}/);
  assert.equal(failures(log).length, 1);
});

test("a URL answering 404 yields gone rather than a silent pass", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch({ ...reachable, [ARTIFACT_URL]: { status: 404, body: new Uint8Array() } }),
  });
  assert.equal(log.records[0].artifact.outcome, "gone");
  assert.match(log.records[0].artifact.detail, /HTTP 404/);
  assert.equal(failures(log).length, 1);
});

test("a redirect to a new address with the same bytes is moved, not intact", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch({
      ...reachable,
      [ARTIFACT_URL]: { url: "https://example.gov/archive/artifact.pdf" },
    }),
  });
  assert.equal(log.records[0].artifact.outcome, "moved");
  assert.equal(failures(log).length, 1);
});

test("a media type the record does not claim is recorded, not escalated to changed", async () => {
  // Identical bytes cannot be a different document. This is the publisher's server
  // relabelling the response, and calling it `changed` would say something untrue
  // about the file -- so it is written down and the outcome stays `intact`.
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch({ ...reachable, [ARTIFACT_URL]: { contentType: "application/octet-stream" } }),
  });
  assert.equal(log.records[0].artifact.outcome, "intact");
  assert.equal(log.records[0].artifact.observedMediaType, "application/octet-stream");
  assert.match(log.records[0].artifact.detail, /record says application\/pdf/);
  assert.deepEqual(failures(log), []);
});

test("a context URL that redirects is moved, and that fails the check", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch({
      ...reachable,
      [CONTEXT_URL]: { url: "https://example.gov/meetings/index", contentType: "text/html" },
    }),
  });
  assert.equal(log.records[0].context.outcome, "moved");
  assert.match(log.records[0].context.detail, /redirects to https:\/\/example\.gov\/meetings\/index/);
  assert.equal(failures(log).length, 1);
});

test("a context URL that never answers is gone, when other URLs did answer", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch({ ...reachable, [CONTEXT_URL]: new Error("ETIMEDOUT") }),
  });
  assert.equal(log.records[0].context.outcome, "gone");
  assert.match(log.records[0].context.detail, /ETIMEDOUT/);
});

test("a context URL is never called intact, because nothing was compared", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch(reachable),
  });
  assert.equal(log.records[0].context.outcome, "reachable");
  assert.notEqual(log.records[0].context.outcome, "intact");
});

test("a context URL that 410s is gone and fails the check", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch({ ...reachable, [CONTEXT_URL]: { status: 410, body: new Uint8Array() } }),
  });
  assert.equal(log.records[0].context.outcome, "gone");
  assert.deepEqual(
    failures(log).map(({ kind }) => kind),
    ["context"],
  );
});

test("when nothing on the network answers, the run cannot happen and writes nothing", async () => {
  const offline = stubFetch({
    [ARTIFACT_URL]: new Error("getaddrinfo ENOTFOUND example.gov"),
    [CONTEXT_URL]: new Error("getaddrinfo ENOTFOUND example.gov"),
  });
  await assert.rejects(
    verifyEvidence({ records: [record()], checkedOn: "2026-09-06", fetchImpl: offline }),
    (error) => error instanceof CannotVerify && /Network unavailable/.test(error.message),
  );
});

test("one dead URL among live ones is gone, not a failed run", async () => {
  const log = await verifyEvidence({
    records: [record(), record({ id: "second", url: "https://example.gov/second.pdf" })],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch({
      ...reachable,
      "https://example.gov/second.pdf": new Error("socket hang up"),
    }),
  });
  assert.equal(log.records[0].artifact.outcome, "intact");
  assert.equal(log.records[1].artifact.outcome, "gone");
  assert.match(log.records[1].artifact.detail, /socket hang up/);
});

test("a run over zero records is refused rather than reported as zero problems", async () => {
  await assert.rejects(
    verifyEvidence({ records: [], checkedOn: "2026-09-06", fetchImpl: stubFetch({}) }),
    (error) => error instanceof CannotVerify && /not a pass/.test(error.message),
  );
});

test("the drafted limitation for a gone artifact passes the verdict-language screen", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch({ ...reachable, [ARTIFACT_URL]: { status: 404, body: new Uint8Array() } }),
  });
  const drafted = draftLimitation(log.records[0], log.checkedOn);
  assert.match(drafted, /could not be retrieved from its published address/);
  assert.match(drafted, /the review date is not moved by this check/);
  // The same screen the published pages are held to: no sentence of drafted
  // prose may carry compliance or performance language.
  const verdicts = splitSentences(drafted).filter((sentence) => verdictPatternIn(sentence));
  assert.deepEqual(verdicts, []);
});

test("an intact record drafts no limitation", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch(reachable),
  });
  assert.equal(draftLimitation(log.records[0], log.checkedOn), null);
});

test("the report prints one line per URL and a summary carrying the denominator", async () => {
  const log = await verifyEvidence({
    records: [record()],
    checkedOn: "2026-09-06",
    fetchImpl: stubFetch(reachable),
  });
  const printed = report(log);
  assert.match(printed, /example-record/);
  assert.match(printed, /artifact intact/);
  assert.match(printed, /context {2}reachable/);
  assert.match(printed, /1 record\(s\), 2 URLs: 1 intact, 0 changed, 0 moved, 0 gone, 1 reachable\./);
});

test("the committed log covers every committed evidence record", async () => {
  const [evidenceData, verification] = await Promise.all([
    readJson("data/evidence.json"),
    readJson("data/evidence-verification.json"),
  ]);
  assert.equal(verification.records.length, evidenceData.evidence.length);
  for (const record of evidenceData.evidence) {
    const verified = verification.records.find(({ id }) => id === record.id);
    assert.ok(verified, `${record.id} is absent from the link-integrity log`);
    assert.equal(verified.artifact.url, record.url);
    assert.equal(verified.context.url, record.contextUrl);
  }
});

test("the committed log records a real comparison, not an empty one", async () => {
  const verification = await readJson("data/evidence-verification.json");
  // Every recorded outcome must be one this vocabulary defines. A log carrying an
  // unrecognised word would render on the evidence page as if it were a verdict.
  for (const record of verification.records) {
    assert.ok(["intact", "changed", "moved", "gone"].includes(record.artifact.outcome));
    assert.ok(["reachable", "moved", "gone"].includes(record.context.outcome));
    if (record.artifact.outcome === "intact") {
      assert.match(record.artifact.observedSha256, /^[a-f0-9]{64}$/);
    }
  }
});
