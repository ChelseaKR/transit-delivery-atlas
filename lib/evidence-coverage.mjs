import { isIsoDate } from "../scripts/iso-date.mjs";

/**
 * Coverage semantics for the evidence layer.
 *
 * An empty evidence list can mean two different things: the listed public
 * sources for a directive were checked and nothing citing the order was found,
 * or nobody has successfully looked yet. Both are published as absence, never as
 * a finding about the directive, but they are different facts and a reader
 * deciding whether to go look themselves needs to know which one they have.
 *
 * These helpers are the single implementation shared by the directive page,
 * the evidence index, the tests, and the question-answering layer, so no
 * surface can derive its own, different, empty state.
 */

/**
 * @typedef {object} ReviewSource
 * @property {string} id
 * @property {string} name
 * @property {string} publisher
 * @property {string} url
 * @property {string[]} coversDirectiveIds
 * @property {string} lastCheckedOn
 * @property {string} lastCheckOutcome "checked" or "retrieval-failed"; JSON imports widen the literal, so the guard below is by value
 * @property {string} note
 */

/**
 * @typedef {object} EvidenceCollection
 * @property {string} lastUpdatedOn
 * @property {string} nextReviewOn
 * @property {ReviewSource[]} reviewSources
 * @property {Array<{ directiveLinks: Array<{ directiveId: string }> }>} evidence
 */

/**
 * @typedef {"linked" | "checked-none-found" | "not-yet-reviewed"} CoverageState
 */

/**
 * @typedef {object} DirectiveCoverage
 * @property {string} directiveId
 * @property {CoverageState} state
 * @property {number} evidenceCount
 * @property {ReviewSource[]} checkedSources sources covering the directive whose last check succeeded
 * @property {ReviewSource[]} failedSources sources covering the directive whose last check did not retrieve content
 * @property {string | null} lastCheckedOn latest successful check across covering sources
 * @property {string} nextReviewOn
 */

function requireDate(value, label) {
  if (!isIsoDate(value)) {
    throw new Error(`${label} must be a real ISO calendar date (received ${JSON.stringify(value)}).`);
  }
  return value;
}

/**
 * @param {string} directiveId
 * @param {EvidenceCollection} collection
 * @returns {DirectiveCoverage}
 */
export function directiveEvidenceCoverage(directiveId, collection) {
  if (typeof directiveId !== "string" || directiveId === "") {
    throw new Error("directiveEvidenceCoverage needs a directive ID.");
  }
  const nextReviewOn = requireDate(collection.nextReviewOn, "evidence nextReviewOn");

  const evidenceCount = collection.evidence.filter((record) =>
    record.directiveLinks.some((link) => link.directiveId === directiveId),
  ).length;

  const covering = collection.reviewSources.filter((source) =>
    source.coversDirectiveIds.includes(directiveId),
  );
  const checkedSources = covering.filter(
    (source) => source.lastCheckOutcome === "checked",
  );
  const failedSources = covering.filter(
    (source) => source.lastCheckOutcome !== "checked",
  );
  for (const source of covering) {
    requireDate(source.lastCheckedOn, `${source.id} lastCheckedOn`);
  }
  const lastCheckedOn =
    checkedSources.length > 0
      ? checkedSources.map(({ lastCheckedOn }) => lastCheckedOn).sort().at(-1)
      : null;

  /** @type {CoverageState} */
  let state;
  if (evidenceCount > 0) state = "linked";
  else if (checkedSources.length > 0) state = "checked-none-found";
  else state = "not-yet-reviewed";

  return {
    directiveId,
    state,
    evidenceCount,
    checkedSources,
    failedSources,
    lastCheckedOn,
    nextReviewOn,
  };
}

/** The sentence every empty state ends with. Named once so it cannot drift. */
export const COVERAGE_NOT_A_FINDING =
  "This is a statement about Atlas coverage, not evidence that no implementation activity or public record exists.";

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * The coverage statement published beside a directive's evidence list.
 *
 * Deliberately says which sources, when, and what comes next, and deliberately
 * never says anything about the directive itself.
 *
 * @param {DirectiveCoverage} coverage
 * @returns {string}
 */
export function coverageStatement(coverage) {
  const failed =
    coverage.failedSources.length > 0
      ? ` ${plural(coverage.failedSources.length, "listed source", "listed sources")} covering this directive (${coverage.failedSources
          .map(({ name }) => name)
          .join("; ")}) could not be retrieved at the last attempt, so that source is not yet reviewed.`
      : "";
  const next = ` The next planned check of the listed sources is ${coverage.nextReviewOn}.`;

  if (coverage.state === "linked") {
    // Evidence can be linked while no review source lists the directive, in
    // which case there is no check date to report. Saying so is the honest
    // reading; interpolating `lastCheckedOn` here published the word "null"
    // into source-linked prose (issue #74). `validate-data.mjs` refuses the
    // data state as well, and this keeps the renderer honest if it ever occurs.
    if (coverage.checkedSources.length === 0) {
      return `${plural(coverage.evidenceCount, "reviewed public artifact is", "reviewed public artifacts are")} linked to this directive. No listed public source covering it has been successfully checked, so this release states no check date for it.${failed}${next}`;
    }
    return `${plural(coverage.evidenceCount, "reviewed public artifact is", "reviewed public artifacts are")} linked to this directive. The ${plural(coverage.checkedSources.length, "listed public source", "listed public sources")} covering it ${coverage.checkedSources.length === 1 ? "was" : "were"} last checked on ${coverage.lastCheckedOn}.${failed}${next}`;
  }
  if (coverage.state === "checked-none-found") {
    return `No reviewed public artifact is linked to this directive. The ${plural(coverage.checkedSources.length, "listed public source", "listed public sources")} covering it ${coverage.checkedSources.length === 1 ? "was" : "were"} last checked on ${coverage.lastCheckedOn}, and no artifact citing the order was found there.${failed}${next} ${COVERAGE_NOT_A_FINDING}`;
  }
  return `No reviewed public artifact is linked to this directive, and no listed public source covering it has been successfully checked yet.${failed}${next} ${COVERAGE_NOT_A_FINDING}`;
}

/**
 * Coverage for every directive, in the order given.
 *
 * @param {string[]} directiveIds
 * @param {EvidenceCollection} collection
 * @returns {DirectiveCoverage[]}
 */
export function coverageForDirectives(directiveIds, collection) {
  return directiveIds.map((id) => directiveEvidenceCoverage(id, collection));
}
