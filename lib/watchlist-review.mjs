import { isIsoDate } from "../scripts/iso-date.mjs";

/**
 * Review-currency rules for the context watchlist.
 *
 * A planned review date that cannot expire is decoration: the published card
 * would keep reading as a forward-looking commitment months after the date
 * passed. These helpers are the single implementation shared by the release
 * gate (`scripts/validate-data.mjs`), the rendered card
 * (`components/WatchlistCard.tsx`), and the tests, so the page and the gate can
 * never disagree about which items are current.
 *
 * Every comparison is made against an explicit reference date. The site is a
 * static export, so the only defensible reference is the build date: a
 * render-time clock would put a claim in the markup that the markup cannot
 * keep.
 */

/**
 * Days of tolerance after `nextReviewOn` before the release gate fails.
 *
 * Inside the window an overdue item is published as overdue and the gate warns;
 * past it the gate fails closed, which deliberately blocks an unrelated deploy
 * until the watchlist is re-reviewed.
 */
export const REVIEW_GRACE_DAYS = 14;

const MS_PER_DAY = 86_400_000;

/**
 * @param {string} value
 * @param {string} label
 * @returns {number} milliseconds since the epoch at UTC midnight
 */
function toUtcTime(value, label) {
  if (!isIsoDate(value)) {
    throw new Error(`${label} must be a real ISO calendar date (received ${JSON.stringify(value)}).`);
  }
  return new Date(`${value}T00:00:00Z`).getTime();
}

/**
 * Whole days from `fromIso` to `toIso`. Negative when `toIso` is earlier.
 *
 * @param {string} fromIso
 * @param {string} toIso
 * @returns {number}
 */
export function daysBetweenIsoDates(fromIso, toIso) {
  return Math.round(
    (toUtcTime(toIso, "date") - toUtcTime(fromIso, "date")) / MS_PER_DAY,
  );
}

/**
 * @typedef {object} ReviewCurrency
 * @property {string} buildDate reference date the claim is made on
 * @property {string} lastReviewedOn
 * @property {string} nextReviewOn
 * @property {boolean} overdue planned review date is in the past
 * @property {number} daysOverdue 0 when not overdue
 * @property {number} daysSinceReview whole days since the last manual check
 * @property {boolean} beyondGrace overdue by more than {@link REVIEW_GRACE_DAYS}
 * @property {number} graceDays
 */

/**
 * @param {{ id?: string, lastReviewedOn: string, nextReviewOn: string }} item
 * @param {string} buildDate
 * @returns {ReviewCurrency}
 */
export function reviewCurrency(item, buildDate) {
  const label = item.id ? `${item.id} review date` : "review date";
  const lastReviewedOn = item.lastReviewedOn;
  const nextReviewOn = item.nextReviewOn;
  toUtcTime(lastReviewedOn, `${label} lastReviewedOn`);
  toUtcTime(nextReviewOn, `${label} nextReviewOn`);
  toUtcTime(buildDate, "build date");

  const daysOverdue = daysBetweenIsoDates(nextReviewOn, buildDate);
  const overdue = daysOverdue > 0;

  return {
    buildDate,
    lastReviewedOn,
    nextReviewOn,
    overdue,
    daysOverdue: overdue ? daysOverdue : 0,
    daysSinceReview: daysBetweenIsoDates(lastReviewedOn, buildDate),
    beyondGrace: daysOverdue > REVIEW_GRACE_DAYS,
    graceDays: REVIEW_GRACE_DAYS,
  };
}

/**
 * Currency of an item's official source date.
 *
 * `scheduled-event` is the only kind that can legitimately sit in the future at
 * review time, which is exactly why a passed scheduled date must not keep
 * rendering as a plain date: the event has happened and the Atlas has not
 * looked at the outcome.
 *
 * @param {{ id?: string, lastReviewedOn: string, sourceDate?: { value: string, kind: string, origin: string } }} item
 * @param {string} buildDate
 * @returns {null | { kind: string, value: string, state: "not-scheduled" | "upcoming" | "reviewed" | "passed-unreviewed" }}
 */
export function sourceDateCurrency(item, buildDate) {
  const sourceDate = item.sourceDate;
  if (!sourceDate) return null;
  toUtcTime(sourceDate.value, "source date");
  toUtcTime(buildDate, "build date");

  if (sourceDate.kind !== "scheduled-event") {
    return { kind: sourceDate.kind, value: sourceDate.value, state: "not-scheduled" };
  }
  if (daysBetweenIsoDates(sourceDate.value, buildDate) < 0) {
    return { kind: sourceDate.kind, value: sourceDate.value, state: "upcoming" };
  }
  if (daysBetweenIsoDates(sourceDate.value, item.lastReviewedOn) >= 0) {
    return { kind: sourceDate.kind, value: sourceDate.value, state: "reviewed" };
  }
  return { kind: sourceDate.kind, value: sourceDate.value, state: "passed-unreviewed" };
}

/**
 * Every item whose planned review date has passed, in the order they lapsed.
 *
 * @param {Array<{ id: string, lastReviewedOn: string, nextReviewOn: string }>} items
 * @param {string} buildDate
 * @returns {Array<{ id: string, nextReviewOn: string, lastReviewedOn: string, daysOverdue: number, beyondGrace: boolean }>}
 */
export function overdueReviews(items, buildDate) {
  return items
    .map((item) => ({ item, currency: reviewCurrency(item, buildDate) }))
    .filter(({ currency }) => currency.overdue)
    .sort((left, right) => right.currency.daysOverdue - left.currency.daysOverdue)
    .map(({ item, currency }) => ({
      id: item.id,
      nextReviewOn: currency.nextReviewOn,
      lastReviewedOn: currency.lastReviewedOn,
      daysOverdue: currency.daysOverdue,
      beyondGrace: currency.beyondGrace,
    }));
}

/**
 * The message the release gate prints. Kept here so the warning and the failure
 * say the same thing.
 *
 * @param {ReturnType<typeof overdueReviews>} overdue
 * @param {string} buildDate
 * @returns {string}
 */
export function overdueReviewReport(overdue, buildDate) {
  return [
    `${overdue.length} context-watchlist item(s) are past their planned review date as of ${buildDate}:`,
    ...overdue.map(
      ({ id, nextReviewOn, lastReviewedOn, daysOverdue }) =>
        `  - ${id}: planned review ${nextReviewOn}, ${daysOverdue} day(s) overdue, last reviewed ${lastReviewedOn}`,
    ),
    `Re-review the source and update lastReviewedOn, evidenceBoundary.checkedOn, and nextReviewOn.`,
    `Moving nextReviewOn without re-reviewing the source restates the same claim with a newer date.`,
  ].join("\n");
}
