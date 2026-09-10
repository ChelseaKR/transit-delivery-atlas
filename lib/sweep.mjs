import { createHash } from "node:crypto";

/**
 * The review sweep, done by machine as far as a machine can honestly take it.
 *
 * `docs/EVIDENCE-MODEL.md` commits this project to a periodic sweep of the
 * official sources that would publish an artifact citing the order. Each sweep
 * has been a manual crawl of a dozen pages, and the record of it -- a `sweeps[]`
 * entry and a `lastCheckedOn` per source -- has been an attestation rather than
 * something reproducible.
 *
 * This does the fetching and reports what moved. It produces a worksheet and a
 * draft patch. **It never writes an evidence record, never marks a source
 * `checked` on a failed fetch, and never touches `nextReviewOn`.** A person
 * reads the worksheet and applies the patch by hand, which is the layer
 * boundary `AGENTS.md` describes, kept by construction rather than by care.
 *
 * ── WHY THE HASH IS OVER TEXT, NOT BYTES ─────────────────────────────────────
 *
 * `lib/evidence-verification.mjs` refuses to hash a context URL, and says why:
 * a publisher's index page "changes whenever they publish anything, and hashing
 * it would report `changed` on every run, which is a check that fails for a
 * reason that is not drift".
 *
 * Every review source here IS such a page. The difference is what the answer is
 * for: over there `changed` means the register's citation broke, and a false one
 * is noise; here `changed` means *go and look*, which is the whole job of a
 * sweep. So a hash is the right instrument -- but only over content, not over
 * bytes. A rotating request id, a build stamp or an embedded "generated at"
 * would flip a byte hash on every run and make the signal worthless while
 * looking exactly like a busy publisher.
 *
 * Two things follow, and both are implemented rather than hoped for:
 *
 *  1. The digest is taken over extracted, normalised text where the text can be
 *     extracted, and the basis is recorded beside it. A stored hash taken over
 *     one basis is never compared against an observation taken over another.
 *  2. Every source is fetched TWICE in the same run. If the two digests differ,
 *     the page is not watchable by digest at all, and the sweep says so instead
 *     of reporting `changed`. That costs one extra request per source and it is
 *     the only per-render churn a single run can detect. It cannot see churn
 *     that is stable within a burst and moves across days -- only a
 *     time-separated sample can, which is what the second real sweep is.
 *
 * ── WHAT A FIRST SWEEP CANNOT SAY ────────────────────────────────────────────
 *
 * With no stored observation there is no baseline, and `no-baseline` is its own
 * outcome. It is not `unchanged`. "Unchanged since 2026-08-21" asserts that
 * something was compared; a first sweep compared nothing, and a tool that says
 * otherwise has published an absence as a measurement — the defect this whole
 * repository is written against.
 *
 * The same applies to the order reference: a page that mentions N-7-26 today is
 * `mentions`, and only a page that mentions it today and demonstrably did not at
 * the last observation is `newly-mentions`. Without a baseline the honest answer
 * is that whether it is new has not been established.
 */

/** The retrieval outcome. `checked` requires a response; nothing else earns it. */
export const RETRIEVAL_OUTCOMES = ["checked", "retrieval-failed"];

/**
 * What the comparison against the stored observation could say.
 *
 * `not-comparable` is the two-fetch stability result: the page answered, twice,
 * with different content. `no-baseline` is a first observation.
 */
export const COMPARISONS = ["unchanged", "changed", "no-baseline", "not-comparable", "not-retrieved"];

/** What the sweep can say about the order reference on a page. */
export const REFERENCES = ["newly-mentions", "mentions", "absent", "not-established"];

/** The order this atlas is built on. Matched case-insensitively in extracted text. */
export const ORDER_REFERENCE = "N-7-26";

const DEFAULT_TIMEOUT_MS = 30_000;

/** Raised when the run could not happen at all, as distinct from finding nothing. */
export class CannotSweep extends Error {}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

/** `text/html; charset=utf-8` -> `text/html`. */
function baseMediaType(headerValue) {
  if (!headerValue) return null;
  return headerValue.split(";")[0].trim().toLowerCase();
}

/**
 * Readable text from an HTML document, normalised so that whitespace and
 * attribute churn do not read as a change.
 *
 * Deliberately small and deliberately not a parser: `<script>` and `<style>`
 * bodies go, tags go, entities that matter come back, runs of whitespace
 * collapse. Anything it gets wrong it gets wrong the same way on both sides of
 * the comparison, which is what a digest needs.
 */
const ENTITIES = new Map([
  ["nbsp", " "],
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["#39", "'"],
]);

export function htmlToText(html) {
  return (
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      // ONE pass over the entities, not one pass each. Unescaping `&amp;` in its
      // own pass and `&lt;` in another turns `&amp;lt;` into `<`: the first pass
      // produces an `&` the second pass consumes, which is a double-unescape and
      // is what CodeQL's js/double-escaping names. A single replace cannot do it,
      // because the text it writes is never re-scanned.
      .replace(/&(nbsp|amp|lt|gt|quot|#39);/gi, (_, name) => ENTITIES.get(name.toLowerCase()))
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * The digest basis for one response.
 *
 * HTML gets a text digest. Everything else -- a PDF above all -- gets a byte
 * digest, because this runtime has no PDF text extractor and adding a
 * dependency to read other people's PDFs is a bigger decision than a sweep
 * tool. `text: null` is carried through so the worksheet can say that the
 * reference check could not run on that source, rather than reporting `absent`
 * about a document nobody read.
 */
export function digestOf(bytes, mediaType) {
  if (mediaType === "text/html" || mediaType === "application/xhtml+xml") {
    const text = htmlToText(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
    return { basis: "text", sha256: sha256(text), text };
  }
  return { basis: "bytes", sha256: sha256(bytes), text: null };
}

/**
 * One HTTP GET, reduced to the facts a classification can be made from.
 *
 * Modelled on `probe()` in lib/evidence-verification.mjs, and for the same
 * reason: `respondedAt: null` is a transport failure, which is what separates
 * "this page is unreachable" from "this machine has no network".
 */
async function probe(url, { fetchImpl, timeoutMs }) {
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      respondedAt: response.url || url,
      status: response.status,
      mediaType: baseMediaType(response.headers.get("content-type")),
      bytes,
      transportError: null,
    };
  } catch (error) {
    return {
      respondedAt: null,
      status: null,
      mediaType: null,
      bytes: null,
      transportError: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Does this text mention the order? `null` when there is no text to read. */
function mentionsOrder(text) {
  if (text === null) return null;
  return text.toLowerCase().includes(ORDER_REFERENCE.toLowerCase());
}

/**
 * Compare one source's two observations against what was stored for it.
 *
 * Pure: everything it needs is an argument, so every branch is reachable from a
 * test without a network.
 */
export function classify({ source, first, second }) {
  const failed = (detail) => ({
    retrieval: "retrieval-failed",
    comparison: "not-retrieved",
    reference: "not-established",
    detail,
    observed: null,
  });

  if (first.transportError) return failed(`did not respond: ${first.transportError}`);
  if (first.status >= 400) return failed(`answered HTTP ${first.status}`);

  const digest = digestOf(first.bytes, first.mediaType);
  const observed = {
    sha256: digest.sha256,
    basis: digest.basis,
    mentionsOrder: mentionsOrder(digest.text),
    servedFrom: first.respondedAt,
    httpStatus: first.status,
    mediaType: first.mediaType,
  };

  // The second fetch. A source that answered once and not the second time is
  // still `checked` -- the content was retrieved -- but nothing can be said
  // about whether its digest is stable, so it is not comparable either.
  if (second.transportError || second.status >= 400) {
    return {
      retrieval: "checked",
      comparison: "not-comparable",
      reference: "not-established",
      detail:
        "answered once and then did not answer again in the same run, so its digest could not be shown to be stable",
      observed,
    };
  }
  const secondDigest = digestOf(second.bytes, second.mediaType);
  if (secondDigest.sha256 !== digest.sha256) {
    return {
      retrieval: "checked",
      comparison: "not-comparable",
      reference: "not-established",
      detail:
        `two requests in the same run produced different ${digest.basis} digests ` +
        `(${digest.sha256.slice(0, 12)}… then ${secondDigest.sha256.slice(0, 12)}…), ` +
        "so this page cannot be watched by digest at all",
      observed,
    };
  }

  const stored = source.lastObservation ?? null;
  const reference = (() => {
    if (observed.mentionsOrder === null) return "not-established";
    if (!observed.mentionsOrder) return "absent";
    if (!stored || typeof stored.mentionsOrder !== "boolean") return "mentions";
    return stored.mentionsOrder ? "mentions" : "newly-mentions";
  })();

  if (!stored) {
    return {
      retrieval: "checked",
      comparison: "no-baseline",
      reference,
      detail:
        "no previous observation is stored for this source, so nothing was compared; " +
        "this run establishes the baseline the next one can use",
      observed,
    };
  }
  if (stored.basis !== digest.basis) {
    return {
      retrieval: "checked",
      comparison: "no-baseline",
      reference,
      detail:
        `the stored digest was taken over ${stored.basis} and this one over ${digest.basis}, ` +
        "so they are not comparable; this run re-establishes the baseline",
      observed,
    };
  }
  if (stored.sha256 === digest.sha256) {
    return {
      retrieval: "checked",
      comparison: "unchanged",
      reference,
      detail: `unchanged since ${stored.observedOn}`,
      observed,
    };
  }
  return {
    retrieval: "checked",
    comparison: "changed",
    reference,
    detail:
      `${digest.basis} digest differs from the one observed on ${stored.observedOn}; ` +
      "no text diff is available because only a digest is retained (see #132)",
    observed,
  };
}

/**
 * Sweep every source.
 *
 * @param {object} options
 * @param {Array} options.sources    `{id, name, publisher, url, kind, lastObservation?}`
 * @param {string} options.sweptOn   ISO date to stamp the worksheet with
 * @param {Function} options.fetchImpl injected so the suite never hits the network
 * @param {number} [options.timeoutMs]
 * @throws {CannotSweep} when there is nothing to sweep, or nothing answered
 */
export async function sweep({ sources, sweptOn, fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!Array.isArray(sources) || sources.length === 0) {
    // A sweep over zero sources would report "0 changed, 0 failed" and exit 0.
    // Same refusal lib/evidence-verification.mjs makes, for the same reason.
    throw new CannotSweep("No sources to sweep; a run over zero sources is not a sweep.");
  }

  const ordered = [...sources].sort((a, b) => a.id.localeCompare(b.id));
  const results = [];
  let responses = 0;
  for (const source of ordered) {
    const first = await probe(source.url, { fetchImpl, timeoutMs });
    const second = await probe(source.url, { fetchImpl, timeoutMs });
    if (first.respondedAt !== null) responses += 1;
    const verdict = classify({ source, first, second });
    results.push({ id: source.id, kind: source.kind, name: source.name, url: source.url, ...verdict });
  }

  if (responses === 0) {
    // Nothing answered at all. Writing `retrieval-failed` against every source
    // on the strength of an unplugged cable would put this machine's state into
    // the register as if it were a finding about the publishers.
    throw new CannotSweep(
      `Network unavailable: none of the ${ordered.length} review sources produced a response.`,
    );
  }

  return { schemaVersion: "0.1.0", sweptOn, orderReference: ORDER_REFERENCE, sources: results };
}

const COUNT_ORDER = ["changed", "newly-mentions", "not-comparable", "no-baseline", "unchanged"];

/** `{unchanged: 3, changed: 1, ...}` over the comparison column. */
export function counts(run) {
  const tally = new Map();
  for (const result of run.sources) {
    tally.set(result.comparison, (tally.get(result.comparison) ?? 0) + 1);
    if (result.reference === "newly-mentions") {
      tally.set("newly-mentions", (tally.get("newly-mentions") ?? 0) + 1);
    }
  }
  return tally;
}

function section(heading, results, render) {
  if (results.length === 0) return [`### ${heading}\n\nNone.`];
  return [`### ${heading}\n`, ...results.map(render)];
}

/**
 * The worksheet, in Markdown.
 *
 * Deterministic by construction: sources are sorted by id, the only date in it
 * is the one passed in, and nothing is timed. Running twice over the same
 * responses produces the same bytes, which is one of this issue's acceptance
 * criteria and is also what makes a diff of two worksheets readable.
 */
export function worksheet(run) {
  const tally = counts(run);
  const by = (predicate) => run.sources.filter(predicate);
  const line = (result) =>
    `- **${result.id}** (${result.kind}) — ${result.detail}\n  <${result.url}>`;

  const failed = by((result) => result.retrieval === "retrieval-failed");
  const notComparable = by((result) => result.comparison === "not-comparable");
  const changed = by((result) => result.comparison === "changed");
  const noBaseline = by((result) => result.comparison === "no-baseline");
  const unchanged = by((result) => result.comparison === "unchanged");
  const newlyMentions = by((result) => result.reference === "newly-mentions");
  const mentionsUnknown = by(
    (result) => result.retrieval === "checked" && result.reference === "not-established",
  );

  return [
    `# Review-source sweep worksheet — ${run.sweptOn}`,
    "",
    `Swept ${run.sources.length} source(s). ` +
      COUNT_ORDER.map((key) => `${tally.get(key) ?? 0} ${key}`).join(", ") +
      `, ${failed.length} retrieval-failed.`,
    "",
    "This is a worksheet, not a record. Nothing here has been written to " +
      "`data/evidence.json` or `data/watchlist.json`; the draft below is applied by hand.",
    "",
    ...section(`Retrieval failed — not "checked", and excluded from every "checked" statement`, failed, line),
    "",
    ...section("Not watchable by digest", notComparable, line),
    "",
    ...section("Changed since the last observation", changed, line),
    "",
    ...section(`Now mention ${run.orderReference} and demonstrably did not before`, newlyMentions, line),
    "",
    ...section("No baseline — nothing was compared", noBaseline, line),
    "",
    ...section("Unchanged", unchanged, line),
    "",
    ...section(
      `Order reference not established — no text could be extracted, so "${run.orderReference} is absent" is not a claim this run can make`,
      mentionsUnknown,
      line,
    ),
    "",
  ].join("\n");
}

/**
 * The patch a reviewer applies by hand.
 *
 * Only two things per source: the outcome of the retrieval, and the observation
 * to store so the *next* sweep has a baseline. `nextReviewOn` is absent by
 * design, and so is anything resembling an evidence record. A source that could
 * not be retrieved carries no observation at all — storing a digest of an error
 * page is how a failed read becomes a baseline.
 */
export function draft(run) {
  return {
    schemaVersion: "0.1.0",
    sweptOn: run.sweptOn,
    note:
      "Draft only. Apply by hand after reading the worksheet. `lastCheckedOn` moves only " +
      "for a source that was retrieved; `nextReviewOn` and every evidence record are " +
      "untouched, and the sweeps[] entry is yours to write.",
    sources: run.sources.map((result) => ({
      id: result.id,
      lastCheckOutcome: result.retrieval,
      ...(result.retrieval === "checked" ? { lastCheckedOn: run.sweptOn } : {}),
      ...(result.retrieval === "checked" && result.comparison !== "not-comparable"
        ? {
            lastObservation: {
              sha256: result.observed.sha256,
              basis: result.observed.basis,
              mentionsOrder: result.observed.mentionsOrder,
              observedOn: run.sweptOn,
            },
          }
        : {}),
    })),
  };
}
