// The sweep assistant's whole value is the distinctions it refuses to collapse,
// so these tests are mostly about what it will NOT say.
//
// Nothing here touches the network: `fetchImpl` is injected, exactly as
// `tests/evidence-verification.test.mjs` does it for the link-integrity check.
import assert from "node:assert/strict";
import test from "node:test";

import {
  CannotSweep,
  ORDER_REFERENCE,
  counts,
  digestOf,
  draft,
  htmlToText,
  sweep,
  worksheet,
} from "../lib/sweep.mjs";

const encoder = new TextEncoder();

/** A fetch that answers from a table of `url -> [response, response…]`. */
function fetcher(table) {
  const served = new Map();
  const impl = async (url) => {
    const answers = table[url];
    if (!answers) throw new Error(`no fixture for ${url}`);
    const index = Math.min(served.get(url) ?? 0, answers.length - 1);
    served.set(url, index + 1);
    const answer = answers[index];
    if (answer.transportError) throw new Error(answer.transportError);
    const body = encoder.encode(answer.body ?? "");
    return {
      url: answer.servedFrom ?? url,
      status: answer.status ?? 200,
      headers: { get: (name) => (name.toLowerCase() === "content-type" ? answer.contentType ?? "text/html; charset=utf-8" : null) },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };
  impl.served = served;
  return impl;
}

const page = (body) => `<html><head><title>x</title></head><body>${body}</body></html>`;

/** The body of one `### ` section of the worksheet, trimmed. */
function sectionOf(sheet, headingStartsWith) {
  const sections = sheet.split("\n### ");
  const found = sections.find((part) => part.startsWith(headingStartsWith));
  assert.ok(found, `no section starting "${headingStartsWith}"`);
  return found.slice(found.indexOf("\n") + 1).trim();
}
const twice = (answer) => [answer, answer];

const SOURCE = {
  id: "ctc-commission-meetings",
  name: "California Transportation Commission meetings",
  publisher: "California Transportation Commission",
  url: "https://catc.ca.gov/meetings-events/commission-meetings",
  kind: "review-source",
};

async function run(sources, table, sweptOn = "2026-09-10") {
  return sweep({ sources, sweptOn, fetchImpl: fetcher(table) });
}

// ---- text extraction and the digest basis ----------------------------------

test("script and style bodies are not part of the text a digest is taken over", () => {
  // The commonest per-render churn on a government index page is an inline
  // script carrying a nonce or a build id. If it reached the digest the page
  // would read as changed on every run.
  const withScript = page('<p>Agenda</p><script>var nonce="abc123";</script>');
  const withOther = page('<p>Agenda</p><script>var nonce="zzz999";</script>');
  assert.equal(htmlToText(withScript), htmlToText(withOther));
  assert.match(htmlToText(withScript), /Agenda/);
});

test("whitespace and tag churn do not change the text digest, but words do", () => {
  const a = digestOf(encoder.encode(page("<p>Tab 19</p>")), "text/html");
  const b = digestOf(encoder.encode(page("<div>\n  Tab   19\n</div>")), "text/html");
  const c = digestOf(encoder.encode(page("<p>Tab 20</p>")), "text/html");
  assert.equal(a.sha256, b.sha256);
  assert.notEqual(a.sha256, c.sha256);
  assert.equal(a.basis, "text");
});

test("a PDF is digested over bytes and yields no text to read", () => {
  const digest = digestOf(encoder.encode("%PDF-1.7 ..."), "application/pdf");
  assert.equal(digest.basis, "bytes");
  assert.equal(digest.text, null);
});

// ---- the four acceptance criteria ------------------------------------------

test('a source that returns 500 is retrieval-failed and reaches no "checked" statement', async () => {
  const result = await run([SOURCE], { [SOURCE.url]: twice({ status: 500, body: "server error" }) });
  const [only] = result.sources;
  assert.equal(only.retrieval, "retrieval-failed");
  assert.equal(only.comparison, "not-retrieved");
  assert.equal(only.reference, "not-established");
  assert.equal(only.observed, null, "a failed retrieval must carry no observation to store");

  const sheet = worksheet(result);
  assert.match(sheet, /### Retrieval failed/);
  assert.match(sheet, /answered HTTP 500/);
  // And the draft never moves the check date for it, nor stores a digest of an
  // error page as the baseline the next sweep would compare against.
  const patch = draft(result);
  assert.deepEqual(patch.sources, [{ id: SOURCE.id, lastCheckOutcome: "retrieval-failed" }]);
});

test("an unchanged page says so with the date it was last observed, and offers no diff", async () => {
  const body = page("<p>August 20-21 meeting book</p>");
  const stored = digestOf(encoder.encode(body), "text/html");
  const source = {
    ...SOURCE,
    lastObservation: {
      sha256: stored.sha256,
      basis: "text",
      mentionsOrder: false,
      observedOn: "2026-08-21",
    },
  };
  const result = await run([source], { [SOURCE.url]: twice({ body }) });
  const [only] = result.sources;
  assert.equal(only.retrieval, "checked");
  assert.equal(only.comparison, "unchanged");
  assert.equal(only.detail, "unchanged since 2026-08-21");
  assert.doesNotMatch(worksheet(result), /diff/i);
});

test(`a page that newly mentions ${ORDER_REFERENCE} is flagged, and nothing else happens`, async () => {
  const source = {
    ...SOURCE,
    lastObservation: {
      sha256: "0".repeat(64),
      basis: "text",
      mentionsOrder: false,
      observedOn: "2026-08-21",
    },
  };
  const result = await run([source], {
    [SOURCE.url]: twice({ body: page("<p>Item 4: implementing Executive Order N-7-26</p>") }),
  });
  const [only] = result.sources;
  assert.equal(only.reference, "newly-mentions");
  assert.match(worksheet(result), /Now mention N-7-26 and demonstrably did not before/);

  // "Nothing else happens" is the load-bearing half. The draft carries an
  // observation and a check date and NOTHING that resembles an evidence record.
  const patch = draft(result);
  assert.deepEqual(Object.keys(patch.sources[0]).sort(), [
    "id",
    "lastCheckOutcome",
    "lastCheckedOn",
    "lastObservation",
  ]);
  // The note says the word "evidence" on purpose; the ROWS are what must not.
  assert.equal(JSON.stringify(patch.sources).includes("evidence"), false);
  assert.equal(JSON.stringify(patch.sources).includes("nextReviewOn"), false);
});

test("running twice over the same responses produces the same worksheet", async () => {
  const table = {
    [SOURCE.url]: twice({ body: page("<p>Agenda</p>") }),
    "https://example.gov/b": twice({ body: page("<p>Other</p>") }),
  };
  const sources = [SOURCE, { ...SOURCE, id: "b-source", url: "https://example.gov/b" }];
  const first = worksheet(await run(sources, table));
  const second = worksheet(await run(sources, table));
  assert.equal(first, second);
});

test("the worksheet is ordered by source id, not by the order the data lists them", async () => {
  const table = {
    "https://example.gov/z": twice({ body: page("z") }),
    "https://example.gov/a": twice({ body: page("a") }),
  };
  const sources = [
    { ...SOURCE, id: "zulu", url: "https://example.gov/z" },
    { ...SOURCE, id: "alpha", url: "https://example.gov/a" },
  ];
  const result = await run(sources, table);
  assert.deepEqual(
    result.sources.map((entry) => entry.id),
    ["alpha", "zulu"],
  );
});

// ---- the distinctions that must not collapse -------------------------------

test("a first sweep is no-baseline, never unchanged", async () => {
  // The hazard named on the issue: "unchanged since YYYY-MM-DD" asserts that
  // something was compared. A first sweep compared nothing.
  const result = await run([SOURCE], { [SOURCE.url]: twice({ body: page("<p>Agenda</p>") }) });
  const [only] = result.sources;
  assert.equal(only.retrieval, "checked");
  assert.equal(only.comparison, "no-baseline");
  assert.match(only.detail, /nothing was compared/);
  assert.doesNotMatch(only.detail, /unchanged/);
});

test("a stored digest taken over a different basis is not compared", async () => {
  const source = {
    ...SOURCE,
    lastObservation: {
      sha256: "0".repeat(64),
      basis: "bytes",
      mentionsOrder: false,
      observedOn: "2026-08-21",
    },
  };
  const result = await run([source], { [SOURCE.url]: twice({ body: page("<p>Agenda</p>") }) });
  assert.equal(result.sources[0].comparison, "no-baseline");
  assert.match(result.sources[0].detail, /taken over bytes and this one over text/);
});

test("a page that answers differently twice in one run is not watchable by digest", async () => {
  // The only per-render churn a single run can detect, and it costs one extra
  // request. Reporting it as `changed` would put a rotating token into the
  // register as a publisher's edit.
  const table = {
    [SOURCE.url]: [
      { body: page('<p>Agenda</p><p>request 8f2a</p>') },
      { body: page('<p>Agenda</p><p>request c410</p>') },
    ],
  };
  const result = await run([SOURCE], table);
  const [only] = result.sources;
  assert.equal(only.retrieval, "checked");
  assert.equal(only.comparison, "not-comparable");
  assert.match(only.detail, /cannot be watched by digest at all/);
  // And it is not offered as a baseline for the next sweep.
  assert.equal("lastObservation" in draft(result).sources[0], false);
});

test("a page whose text cannot be read does not report the order reference as absent", async () => {
  // A PDF gets a byte digest and no text. "N-7-26 is absent" would be a claim
  // about a document nobody read.
  const result = await run([SOURCE], {
    [SOURCE.url]: twice({ body: "%PDF-1.7 ...", contentType: "application/pdf" }),
  });
  const [only] = result.sources;
  assert.equal(only.reference, "not-established");
  assert.equal(only.observed.basis, "bytes");
  assert.match(worksheet(result), /Order reference not established/);
});

test("a page that mentions the order with no baseline is `mentions`, not `newly-mentions`", async () => {
  const result = await run([SOURCE], {
    [SOURCE.url]: twice({ body: page("<p>Executive Order N-7-26</p>") }),
  });
  assert.equal(result.sources[0].reference, "mentions");
  assert.equal(sectionOf(worksheet(result), "Now mention"), "None.");
});

test("a source that answers once and not again is checked but not comparable", async () => {
  const table = {
    [SOURCE.url]: [{ body: page("<p>Agenda</p>") }, { transportError: "socket hang up" }],
  };
  const [only] = (await run([SOURCE], table)).sources;
  assert.equal(only.retrieval, "checked");
  assert.equal(only.comparison, "not-comparable");
});

test("a transport failure is retrieval-failed and names what happened", async () => {
  // Paired with a source that answers, because a run in which NOTHING answered
  // is refused outright — see the refusal test below.
  const result = await run([SOURCE, { ...SOURCE, id: "b-source", url: "https://example.gov/b" }], {
    [SOURCE.url]: twice({ transportError: "getaddrinfo ENOTFOUND" }),
    "https://example.gov/b": twice({ body: page("<p>ok</p>") }),
  });
  const only = result.sources.find((entry) => entry.id === SOURCE.id);
  assert.equal(only.retrieval, "retrieval-failed");
  assert.match(only.detail, /did not respond: .*ENOTFOUND/);
});

// ---- refusals --------------------------------------------------------------

test("a sweep over zero sources is refused, not reported as a clean sweep", async () => {
  await assert.rejects(
    () => sweep({ sources: [], sweptOn: "2026-09-10", fetchImpl: fetcher({}) }),
    CannotSweep,
  );
});

test("a run in which nothing answered at all is refused", async () => {
  // Otherwise every source is written down as retrieval-failed on the strength
  // of this machine's network, which is a claim about the publishers.
  await assert.rejects(
    () =>
      run(
        [SOURCE, { ...SOURCE, id: "b-source", url: "https://example.gov/b" }],
        {
          [SOURCE.url]: twice({ transportError: "ENOTFOUND" }),
          "https://example.gov/b": twice({ transportError: "ENOTFOUND" }),
        },
      ),
    CannotSweep,
  );
});

// ---- the worksheet ---------------------------------------------------------

test("every section prints, including the empty ones, with a count line above", async () => {
  // An absent section reads as "there were none of those" only if the reader
  // knows the section exists. Printing "None." says it.
  const result = await run([SOURCE], { [SOURCE.url]: twice({ body: page("<p>Agenda</p>") }) });
  const sheet = worksheet(result);
  for (const heading of [
    "Retrieval failed",
    "Not watchable by digest",
    "Changed since the last observation",
    "No baseline",
    "Unchanged",
  ]) {
    assert.match(sheet, new RegExp(`### ${heading}`), `${heading} section is missing`);
  }
  assert.match(sheet, /Swept 1 source\(s\)\. 0 changed, 0 newly-mentions, 0 not-comparable, 1 no-baseline, 0 unchanged, 0 retrieval-failed\./);
});

test("the counts add up to the sources swept", async () => {
  const table = {
    [SOURCE.url]: twice({ body: page("<p>a</p>") }),
    "https://example.gov/b": twice({ status: 503, body: "" }),
  };
  const result = await run([SOURCE, { ...SOURCE, id: "b-source", url: "https://example.gov/b" }], table);
  const tally = counts(result);
  const comparisons = [...tally].filter(([key]) => key !== "newly-mentions");
  assert.equal(
    comparisons.reduce((total, [, value]) => total + value, 0),
    result.sources.length,
  );
});

test("the worksheet says in terms that nothing has been written", async () => {
  const result = await run([SOURCE], { [SOURCE.url]: twice({ body: page("<p>a</p>") }) });
  assert.match(worksheet(result), /Nothing here has been written to/);
});
