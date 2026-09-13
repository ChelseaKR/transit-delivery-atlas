import { isIsoDate } from "../scripts/iso-date.mjs";

/**
 * When each published route last changed, for the sitemap's `<lastmod>`.
 *
 * The Atlas gave all 21 directive URLs one `<lastmod>`: `2026-07-12`, the
 * `lastReviewedOn` carried by every directive record. The other nine URLs carried
 * none. Measured live on 2026-09-13, that date was two months old while the
 * evidence layer had been swept on 2026-09-06 and re-reviewed records were on the
 * pages it dated — so the one date a sitemap offers as a fact about the content was
 * two months behind content the page was already serving.
 *
 * **Why this is not the build date, which the page's own arithmetic would suggest.**
 * A directive page re-renders every build: `lib/directive-timing.mjs` writes "this
 * calculated date is 42 days after the build it is published from", and that number
 * moves every day the site is rebuilt. The bytes change; the document does not.
 * `<lastmod>` is defined as the date of last *significant* modification, and a
 * recalculated countdown is the textbook example of a change that is not one — the
 * sitemaps guidance names it. Stamping the build date here would be the defect this
 * project files against other sites, arriving through the front door: 30 URLs
 * claiming they changed this morning, every morning, forever.
 *
 * **So the date comes from the record-level change log** (`lib/changes.mjs`), which
 * already answers exactly this question and is already gated. Every entry there
 * declares the `path` the record can be read at, the directives it links to, and —
 * the field that makes this possible — whether its date is carried by the data or is
 * this build's own observation. Only `observedBy: "data"` entries are read here. A
 * lapsed review is dated to the build that noticed it, and noticing is not
 * modifying, so those are excluded by construction rather than by a filter someone
 * has to remember to keep.
 *
 * **A route with nothing dated behind it gets no `<lastmod>`.** The element is
 * optional, and the honest artifact for "no record here carries a date" is silence,
 * not a guess. Seven routes are in that position (`/`, `/handoffs/`, `/data/`,
 * `/methodology/`, `/accessibility/`, `/research/tda-ntd/`, and `/corrections/`
 * until a correction is recorded), and they carry no date today either — the
 * difference is that there is now a rule saying why rather than an omission.
 */

/** A directive page publishes its own record, so its own review date counts. */
function directiveRoute(id) {
  return `/directives/${id}/`;
}

function newest(dates) {
  return dates.reduce((best, date) => (date > best ? date : best));
}

/**
 * The newest date behind each route, as `route path -> ISO calendar date`.
 *
 * A directive route takes the newest of its own review date and every data-dated
 * entry that either lives on it or links to it, because the page publishes the
 * directive record together with the evidence records and watchlist items linked to
 * it — a linked artifact re-reviewed in September changes what that page says, and
 * the old value could not see it. Every other route takes the newest data-dated
 * entry that declares it as its path.
 *
 * @param {object} input
 * @param {import("./changes.mjs").ChangeEntry[]} input.entries every entry `deriveChanges` produced
 * @param {Array<{ id: string, lastReviewedOn: string }>} input.directives
 * @returns {Map<string, string>}
 */
export function lastModifiedByRoute({ entries, directives }) {
  const dated = entries.filter((entry) => entry.observedBy === "data");
  const byRoute = new Map();

  const add = (route, date) => {
    const existing = byRoute.get(route);
    byRoute.set(route, existing === undefined ? date : newest([existing, date]));
  };

  for (const entry of dated) {
    add(entry.path, entry.date);
  }

  for (const directive of directives) {
    if (!isIsoDate(directive.lastReviewedOn)) {
      throw new Error(
        `${directive.id} has no usable lastReviewedOn (${JSON.stringify(directive.lastReviewedOn)}). ` +
          "A directive page publishes its own review date, so the sitemap cannot date it without one.",
      );
    }
    add(directiveRoute(directive.id), directive.lastReviewedOn);
    for (const entry of dated) {
      if (entry.directiveIds.includes(directive.id)) {
        add(directiveRoute(directive.id), entry.date);
      }
    }
  }

  return byRoute;
}

/**
 * How many routes a sitemap dates, of how many it lists.
 *
 * Both numbers, and exported so the build and the tests read the same pair. A
 * denominator is the whole difference between "every route this site can date is
 * dated" and "this build could date nothing and said so quietly".
 *
 * @param {Array<{ url: string, lastModified?: string }>} sitemapEntries
 * @returns {{ dated: number, total: number }}
 */
export function datedCoverage(sitemapEntries) {
  return {
    dated: sitemapEntries.filter((entry) => entry.lastModified !== undefined).length,
    total: sitemapEntries.length,
  };
}
