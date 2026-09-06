import { createHash } from "node:crypto";

/**
 * Re-check that every cited evidence artifact is still the bytes the register
 * reviewed.
 *
 * Every record in `data/evidence.json` carries a `sha256` so a quotation from it
 * can be verified against the publisher's own file. Nothing ever re-checked that
 * hash after the review, so link rot or a silent re-issue would leave the
 * register asserting a relationship to bytes that no longer exist, with every
 * gate green.
 *
 * The rule the rest of this repository follows applies here too: absence is
 * disclosed, not deleted. A record whose artifact is gone keeps its review date
 * and its place in the register; what changes is that the site can say so.
 *
 * WHAT IS COMPARED, AND WHAT IS NOT
 *
 * The artifact URL has a stored hash, so it can be compared: same bytes, other
 * bytes, or no bytes at all. The context URL does not — it is a publisher's index
 * page that changes whenever they publish anything, and hashing it would report
 * "changed" on every run, which is a check that fails for a reason that is not
 * drift. It is therefore only ever `reachable`, `moved`, or `gone`, and it is
 * never called `intact`: nothing was compared, and a word that says otherwise
 * would be the same defect this check exists to catch.
 */

/** The artifact outcomes, in the order the report prints them. */
export const ARTIFACT_OUTCOMES = ["intact", "changed", "moved", "gone"];
/** The context-URL outcomes. `intact` is deliberately not among them. */
export const CONTEXT_OUTCOMES = ["reachable", "moved", "gone"];

/** Any of these means the register no longer resolves to what it reviewed. */
const FAILING_OUTCOMES = new Set(["changed", "moved", "gone"]);

const DEFAULT_TIMEOUT_MS = 30_000;

/** Raised when the run could not happen at all, as distinct from finding a problem. */
export class CannotVerify extends Error {}

/** @param {Uint8Array} bytes */
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** `application/pdf; charset=binary` -> `application/pdf`. */
function baseMediaType(headerValue) {
  if (!headerValue) return null;
  return headerValue.split(";")[0].trim().toLowerCase();
}

/**
 * One HTTP GET, reduced to the facts a classification can be made from.
 *
 * A transport failure (DNS, connect, TLS, timeout) is reported as
 * `respondedAt: null`, which is what separates "this URL is gone" from "this
 * machine has no network": a URL that answered 404 produced a response, and a
 * run in which *nothing* answered produced none.
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

/** @returns {{outcome: string, detail: string}} */
function classifyArtifact(record, observation) {
  if (observation.transportError) {
    return { outcome: "gone", detail: `did not respond: ${observation.transportError}` };
  }
  if (observation.status >= 400) {
    return { outcome: "gone", detail: `answered HTTP ${observation.status}` };
  }
  const observedSha256 = sha256(observation.bytes);
  if (observedSha256 !== record.sha256) {
    return {
      outcome: "changed",
      detail: `hash is ${observedSha256}, the reviewed artifact hashed ${record.sha256}`,
    };
  }
  if (observation.respondedAt !== record.url) {
    return { outcome: "moved", detail: `same bytes, now served from ${observation.respondedAt}` };
  }
  if (observation.mediaType !== record.mediaType) {
    // Identical bytes cannot be a different document, so this is the publisher's
    // server relabelling the response, not the artifact changing. Recorded, not
    // escalated: calling it `changed` would say something untrue about the file.
    return {
      outcome: "intact",
      detail: `bytes match; served as ${observation.mediaType ?? "no media type"}, record says ${record.mediaType}`,
    };
  }
  return { outcome: "intact", detail: "bytes match the reviewed artifact" };
}

/** @returns {{outcome: string, detail: string}} */
function classifyContext(url, observation) {
  if (observation.transportError) {
    return { outcome: "gone", detail: `did not respond: ${observation.transportError}` };
  }
  if (observation.status >= 400) {
    return { outcome: "gone", detail: `answered HTTP ${observation.status}` };
  }
  if (observation.respondedAt !== url) {
    return { outcome: "moved", detail: `redirects to ${observation.respondedAt}` };
  }
  return { outcome: "reachable", detail: `answered HTTP ${observation.status}` };
}

/**
 * Verify every record's artifact and context URL.
 *
 * @param {object} options
 * @param {Array} options.records          `data/evidence.json`'s `evidence` array
 * @param {string} options.checkedOn       ISO date to stamp the log with
 * @param {Function} options.fetchImpl     injected so the suite never hits the network
 * @param {number} [options.timeoutMs]
 * @returns {Promise<object>} the verification log
 * @throws {CannotVerify} when nothing answered at all
 */
export async function verifyEvidence({
  records,
  checkedOn,
  fetchImpl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!Array.isArray(records) || records.length === 0) {
    // A verification run over zero records would report "0 changed, 0 gone" and
    // exit 0, which is the shape this repository already refuses elsewhere: a
    // check that read nothing is not a check that passed.
    throw new CannotVerify("No evidence records to verify; a run over zero records is not a pass.");
  }

  const verified = [];
  let responses = 0;
  for (const record of records) {
    const artifactObservation = await probe(record.url, { fetchImpl, timeoutMs });
    const contextObservation = await probe(record.contextUrl, { fetchImpl, timeoutMs });
    if (artifactObservation.respondedAt !== null) responses += 1;
    if (contextObservation.respondedAt !== null) responses += 1;

    const artifact = classifyArtifact(record, artifactObservation);
    const context = classifyContext(record.contextUrl, contextObservation);
    verified.push({
      id: record.id,
      // Carried per record as well as at the top of the log. A page renders one
      // record at a time, and a per-record date is the only one it can state
      // truthfully if a later log ever accumulates runs instead of replacing
      // them -- reading the file-level date for a record that run did not touch
      // is how "never checked" becomes "checked today".
      checkedOn,
      artifact: {
        url: record.url,
        outcome: artifact.outcome,
        detail: artifact.detail,
        httpStatus: artifactObservation.status,
        servedFrom: artifactObservation.respondedAt,
        observedSha256: artifactObservation.bytes ? sha256(artifactObservation.bytes) : null,
        observedMediaType: artifactObservation.mediaType,
      },
      context: {
        url: record.contextUrl,
        outcome: context.outcome,
        detail: context.detail,
        httpStatus: contextObservation.status,
        servedFrom: contextObservation.respondedAt,
      },
    });
  }

  if (responses === 0) {
    // Nothing answered. Every URL here is on the open web, so this is this
    // machine's network, not four simultaneous takedowns -- and writing "gone"
    // against every record on the strength of an unplugged cable would put an
    // absence into the register as if it were a finding.
    throw new CannotVerify(
      `Network unavailable: none of the ${records.length * 2} requested URLs produced a response.`,
    );
  }

  return { schemaVersion: "0.1.0", checkedOn, records: verified };
}

/** Every outcome in the log that means the register no longer resolves. */
export function failures(log) {
  const found = [];
  for (const record of log.records) {
    if (FAILING_OUTCOMES.has(record.artifact.outcome)) {
      found.push({ id: record.id, kind: "artifact", ...record.artifact });
    }
    if (FAILING_OUTCOMES.has(record.context.outcome)) {
      found.push({ id: record.id, kind: "context", ...record.context });
    }
  }
  return found;
}

/**
 * Draft the sentence a record would carry if its artifact no longer resolves.
 *
 * Drafted, never applied: a limitation is published prose about a public body's
 * record, and it goes into `data/evidence.json` by a person's hand. The wording
 * states what was observed and on what date, and makes no claim about why.
 */
export function draftLimitation(record, checkedOn) {
  const { outcome, servedFrom } = record.artifact;
  if (outcome === "intact") return null;
  const observed = {
    changed:
      "no longer matches the file reviewed for this record; the publisher has edited or re-issued it at the same address",
    moved: `is now served from ${servedFrom}`,
    gone: "could not be retrieved from its published address",
  }[outcome];
  return `Checked on ${checkedOn}: the artifact at ${record.artifact.url} ${observed}. This record continues to describe the artifact as reviewed on its Atlas review date, and the review date is not moved by this check. Whether the artifact is still available elsewhere has not been established.`;
}

/** The per-record outcome table the command prints. */
export function report(log) {
  const lines = [`Evidence link integrity, checked ${log.checkedOn}:`];
  for (const record of log.records) {
    lines.push(`  ${record.id}`);
    lines.push(`    artifact ${record.artifact.outcome.padEnd(9)} ${record.artifact.detail}`);
    lines.push(`    context  ${record.context.outcome.padEnd(9)} ${record.context.detail}`);
  }
  const counts = new Map();
  for (const record of log.records) {
    for (const half of [record.artifact, record.context]) {
      counts.set(half.outcome, (counts.get(half.outcome) ?? 0) + 1);
    }
  }
  const summary = [...ARTIFACT_OUTCOMES, ...CONTEXT_OUTCOMES]
    .filter((outcome, index, all) => all.indexOf(outcome) === index)
    .map((outcome) => `${counts.get(outcome) ?? 0} ${outcome}`)
    .join(", ");
  lines.push(`  ${log.records.length} record(s), ${log.records.length * 2} URLs: ${summary}.`);
  return lines.join("\n");
}
