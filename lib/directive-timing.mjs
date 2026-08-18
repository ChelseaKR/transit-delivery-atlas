import { isIsoDate } from "../scripts/iso-date.mjs";
import { daysBetweenIsoDates } from "./watchlist-review.mjs";

/**
 * Currency rules for the planning dates the Atlas calculates from the order.
 *
 * `lib/watchlist-review.mjs` already establishes the rule for one class of
 * published date: a date that cannot expire is decoration, because the markup
 * keeps reading as forward-looking long after the date passes. The register's
 * timing column is the same class of claim and did not have the rule. Seven of
 * the twenty-one directives carry a calculated date of 2026-10-24 and one
 * carries 2027-06-26; before this module those cells rendered as a bare date
 * for ever, so a build served after the date would still present it as
 * something that is going to happen.
 *
 * Two boundaries make this different from the watchlist, and both are
 * deliberate:
 *
 * 1. **A passed planning date never fails the release gate.** A lapsed
 *    watchlist review is a defect in the Atlas's own upkeep, so it blocks a
 *    release. A calendar date arriving is a fact about the world, not a defect,
 *    and failing the build on it would block every deploy from 2026-10-25
 *    onward for no reason a re-review could clear.
 * 2. **`passed` is arithmetic, not a finding.** The order's non-enforceability
 *    clause is in the dataset, the derived dates are the Atlas's own
 *    subtraction rather than text from the order, and the project is explicitly
 *    not an accountability dashboard. "The calculated date has passed" is the
 *    only claim supported here; "late", "missed", "non-compliant", and
 *    "incomplete" are not, and nothing outside the reviewed public record is
 *    observed either way.
 *
 * Every comparison is made against an explicit reference date. The site is a
 * static export, so the only defensible reference is the build date - the same
 * one the watchlist states its currency against.
 */

/**
 * @typedef {object} TimingCurrency
 * @property {string} referenceDate date the claim is made on
 * @property {string} derivedDate the calculated planning date
 * @property {boolean} passed the calculated date is strictly before the reference date
 * @property {number} daysUntil whole days remaining, 0 once passed
 * @property {number} daysSince whole days since it passed, 0 while upcoming
 */

/**
 * Whether a calculated planning date has passed at `referenceDate`.
 *
 * The date itself is the last day inside a "within N days" window, so a
 * directive whose calculated date equals the reference date has not passed.
 * This matches `reviewCurrency`, which treats a review as overdue only strictly
 * after its planned date.
 *
 * @param {{ derivedDate: string }} timing
 * @param {string} referenceDate
 * @returns {TimingCurrency}
 */
export function timingCurrency(timing, referenceDate) {
  const derivedDate = timing?.derivedDate;
  if (!isIsoDate(derivedDate)) {
    throw new Error(
      `A calculated planning date must be a real ISO calendar date (received ${JSON.stringify(derivedDate)}). A timing cell whose currency cannot be computed must not render.`,
    );
  }
  if (!isIsoDate(referenceDate)) {
    throw new Error(
      `The reference date must be a real ISO calendar date (received ${JSON.stringify(referenceDate)}). Timing currency is never stated against an implicit clock.`,
    );
  }

  const elapsed = daysBetweenIsoDates(derivedDate, referenceDate);
  const passed = elapsed > 0;

  return {
    referenceDate,
    derivedDate,
    passed,
    // `Math.abs` rather than negation: on the day the date falls, `elapsed` is
    // 0 and negating it yields `-0`, which reads as 0 everywhere except a
    // strict comparison, where it would quietly fail one.
    daysUntil: passed ? 0 : Math.abs(elapsed),
    daysSince: passed ? elapsed : 0,
  };
}

/**
 * Every calculated planning date that has passed, most recently lapsed last.
 *
 * Used by the release gate to report - never to fail - and by the tests.
 *
 * @param {Array<{ id: string, label: string, timing?: Array<{ derivedDate: string, sourceText: string, appliesTo: string }> }>} directives
 * @param {string} referenceDate
 * @returns {Array<{ directiveId: string, label: string, derivedDate: string, sourceText: string, appliesTo: string, daysSince: number }>}
 */
export function passedTimings(directives, referenceDate) {
  return directives
    .flatMap((directive) =>
      (directive.timing ?? []).map((timing) => ({ directive, timing })),
    )
    .map(({ directive, timing }) => ({
      directive,
      timing,
      currency: timingCurrency(timing, referenceDate),
    }))
    .filter(({ currency }) => currency.passed)
    .sort((left, right) => right.currency.daysSince - left.currency.daysSince)
    .map(({ directive, timing, currency }) => ({
      directiveId: directive.id,
      label: directive.label,
      derivedDate: currency.derivedDate,
      sourceText: timing.sourceText,
      appliesTo: timing.appliesTo,
      daysSince: currency.daysSince,
    }));
}

/**
 * The line the release gate prints about calculated planning dates.
 *
 * Reporting only. The wording carries the boundary with it so a maintainer
 * reading CI output does not read a passed date as a finding about an agency.
 *
 * @param {ReturnType<typeof passedTimings>} passed
 * @param {number} totalTimings
 * @param {string} referenceDate
 * @returns {string}
 */
export function passedTimingReport(passed, totalTimings, referenceDate) {
  const headline = `Calculated planning dates at ${referenceDate}: ${passed.length} of ${totalTimings} have passed.`;
  if (passed.length === 0) return headline;

  return [
    headline,
    ...passed.map(
      ({ label, derivedDate, daysSince }) =>
        `  - ${label}: calculated ${derivedDate}, passed ${daysSince} day(s) ago`,
    ),
    "A passed calculated date is arithmetic on the order's own language, not a finding that a directive is late, incomplete, or out of compliance. It does not fail the gate.",
  ].join("\n");
}
