import { isIsoDate } from "../scripts/iso-date.mjs";
import { timingCurrency } from "./directive-timing.mjs";
import { reviewCurrency } from "./watchlist-review.mjs";

/**
 * The record-level change log, and the Atom feed rendered from it.
 *
 * The site has no accounts, no analytics, and no subscriptions, by design. An
 * Atom feed is the one push channel that respects all three: static, anonymous,
 * standard, and readable by anything. This module derives the entries from the
 * committed data and the build date, and renders them; nothing here fetches,
 * and nothing reads a clock.
 *
 * Three rules make the log a record rather than a narrative.
 *
 * **An entry says what the Atlas did, never what a body did.** "Two evidence
 * records were added at a sweep" is a fact about this repository. "Caltrans
 * published its list" is a finding, and the verdict lexicon exists to keep it
 * out. `tests/changes.test.mjs` screens every entry's title and detail through
 * `lib/verdict-language.mjs`, which is the same screen the published pages get.
 *
 * **An entry resolves to a record, or the derivation fails.** A feed entry
 * linking to a record that is not in the dataset is an absence rendered as a
 * value: the reader sees a change, follows it, and finds nothing. Every id an
 * entry names is checked against the collections it came from, and an unknown
 * one throws rather than being dropped, because dropping it would publish a
 * shorter feed and say nothing about why.
 *
 * **Two kinds of date, kept apart.** Most entries are dated to a date the data
 * itself carries: a sweep date, a review date, a re-check date, a calculated
 * planning date. Those are `observedBy: "data"` and do not move when the site
 * is rebuilt. A lapsed review date is different — nothing in the data records
 * the day the lapse was noticed, because the lapse is the absence of a record —
 * so those entries are `observedBy: "build"` and dated to the build that
 * observed them. Rebuilding an unchanged dataset on a later date therefore adds
 * nothing except the entries the later build date itself justifies.
 */

/** Layer labels, matching the four the register already publishes. */
export const CHANGE_LAYERS = ["source", "evidence", "analysis", "context"];

/**
 * Every kind of entry this module emits, with the layer it belongs to.
 *
 * Named as data rather than written at each call site so the feed's category
 * terms, the per-layer filters and the tests all read one list. A kind added
 * without a layer is a `TypeError` here rather than an uncategorised entry in a
 * published feed.
 */
export const CHANGE_KINDS = Object.freeze({
  "sweep-recorded": "evidence",
  "evidence-added": "evidence",
  "evidence-reviewed": "evidence",
  "evidence-artifact-rechecked": "evidence",
  "watchlist-reviewed": "context",
  "watchlist-narrowed": "context",
  "planning-date-passed": "analysis",
  "review-date-lapsed": "evidence",
  "source-correction-applied": "source",
});

const TAG_AUTHORITY = "transit.chelseakr.com";

function requireDate(value, label) {
  if (!isIsoDate(value)) {
    throw new Error(
      `${label} must be a real ISO calendar date (received ${JSON.stringify(value)}).`,
    );
  }
  return value;
}

/**
 * @typedef {object} ChangeEntry
 * @property {string} id stable tag URI, derived from kind, record and date
 * @property {string} date ISO calendar date the entry is dated to
 * @property {string} kind one of {@link CHANGE_KINDS}
 * @property {string} layer the layer the record belongs to
 * @property {string} recordId the id of the record the entry is about
 * @property {string} path site path where that record can be read
 * @property {string[]} directiveIds directives the record is linked to, sorted
 * @property {string} title one line, no verdict language
 * @property {string} detail one or two sentences, no verdict language
 * @property {"data" | "build"} observedBy whether the date is in the data or is this build's observation
 */

function entry({ kind, date, recordId, path, directiveIds, title, detail, observedBy }) {
  const layer = CHANGE_KINDS[kind];
  if (layer === undefined) {
    throw new TypeError(`${kind} is not a change kind this build knows how to categorise.`);
  }
  requireDate(date, `${kind} entry date`);
  return {
    id: `tag:${TAG_AUTHORITY},${date.slice(0, 4)}:changes/${kind}/${recordId}/${date}`,
    date,
    kind,
    layer,
    recordId,
    path,
    directiveIds: [...directiveIds].sort(),
    title,
    detail,
    observedBy,
  };
}

/** Directive ids a record links to, from the `directiveLinks` shape both layers use. */
function linkedDirectives(record) {
  return (record?.directiveLinks ?? []).map((link) => link.directiveId);
}

/**
 * Check that every id an entry names is a record the dataset holds.
 *
 * Throws rather than filters. A feed that quietly drops the entries it could
 * not resolve publishes a shorter list and says nothing about why, which is the
 * failure this project spends most of its gates on.
 */
function requireRecord(known, id, context) {
  if (!known.has(id)) {
    throw new Error(
      `${context} names ${JSON.stringify(id)}, which is not a record in the dataset. A change ` +
        "entry that does not resolve to a record is a link a reader follows to nothing.",
    );
  }
  return known.get(id);
}

function sweepEntries(evidence, evidenceById) {
  const entries = [];
  for (const sweep of evidence.sweeps ?? []) {
    const added = [...(sweep.addedEvidenceIds ?? [])].sort();
    entries.push(
      entry({
        kind: "sweep-recorded",
        date: requireDate(sweep.sweptOn, "sweep sweptOn"),
        recordId: `sweep-${sweep.sweptOn}`,
        path: "/evidence/",
        directiveIds: [],
        title: `Review sweep recorded for ${sweep.sourceIds.length} listed public source(s)`,
        detail:
          `The listed public sources were read on ${sweep.sweptOn}. ` +
          `${added.length} reviewed public artifact(s) were added to the evidence layer at this sweep.`,
        observedBy: "data",
      }),
    );
    for (const id of added) {
      const record = requireRecord(evidenceById, id, `the sweep of ${sweep.sweptOn}`);
      entries.push(
        entry({
          kind: "evidence-added",
          date: sweep.sweptOn,
          recordId: id,
          path: "/evidence/",
          directiveIds: linkedDirectives(record),
          title: `Evidence record added: ${record.title}`,
          detail:
            `A reviewed public artifact published by ${record.publisher} was added to the ` +
            `evidence layer at the sweep of ${sweep.sweptOn}. Inclusion documents a source ` +
            "relationship and nothing about any body's activity.",
          observedBy: "data",
        }),
      );
    }
  }
  return entries;
}

function evidenceReviewEntries(evidence) {
  return evidence.evidence.map((record) =>
    entry({
      kind: "evidence-reviewed",
      date: requireDate(record.lastReviewedOn, `${record.id} lastReviewedOn`),
      recordId: record.id,
      path: "/evidence/",
      directiveIds: linkedDirectives(record),
      title: `Evidence record re-reviewed: ${record.title}`,
      detail: `The reviewed artifact and its editorial summary were read again on ${record.lastReviewedOn}.`,
      observedBy: "data",
    }),
  );
}

/**
 * Entries from the artifact re-hash log.
 *
 * This is the second retrieval path the evidence layer has, and it is reused
 * rather than reimplemented: `data/evidence-verification.json` already records
 * a dated outcome per artifact, which is exactly what an entry needs. The
 * outcome word travels through unchanged — `intact`, `changed`, `moved`,
 * `gone` — because a re-hash is a statement about bytes at a URL and reading
 * anything else into it is the whole reason the vocabulary is separate.
 */
function verificationEntries(verification, evidenceById) {
  if (!verification) return [];
  return (verification.records ?? []).map((record) => {
    const evidence = requireRecord(
      evidenceById,
      record.id,
      "the artifact verification log",
    );
    const outcome = record.artifact?.outcome ?? "unrecorded";
    return entry({
      kind: "evidence-artifact-rechecked",
      date: requireDate(record.checkedOn, `${record.id} verification checkedOn`),
      recordId: record.id,
      path: "/evidence/",
      directiveIds: linkedDirectives(evidence),
      title: `Cited artifact re-checked: ${evidence.title}`,
      detail:
        `The artifact at the cited URL was retrieved again on ${record.checkedOn} and recorded ` +
        `as ${outcome}: ${record.artifact?.detail ?? "no detail recorded"}.`,
      observedBy: "data",
    });
  });
}

/**
 * One entry per watchlist item, dated to its latest review.
 *
 * The evidence-rule check is folded into that entry rather than emitted as its
 * own kind. `scripts/validate-data.mjs` requires `evidenceBoundary.checkedOn`
 * to equal `lastReviewedOn`, so a separate kind for it could never produce an
 * entry that the review entry did not already cover on the same date --- a kind
 * that cannot occur is decoration, and this project spends most of its gates
 * refusing exactly that shape elsewhere.
 */
function watchlistEntries(watchlist) {
  return (watchlist.items ?? []).map((item) => {
    const boundary = item.evidenceBoundary ?? {};
    if (boundary.checkedOn !== undefined && boundary.checkedOn !== item.lastReviewedOn) {
      throw new Error(
        `${item.id} records an evidence-rule check on ${boundary.checkedOn} and a review on ` +
          `${item.lastReviewedOn}. The two dates are held equal by the release gate, and the ` +
          "change log states one date for both; publishing the review date alone would date the " +
          "rule check to a day nobody made it.",
      );
    }
    return entry({
      kind: "watchlist-reviewed",
      date: requireDate(item.lastReviewedOn, `${item.id} lastReviewedOn`),
      recordId: item.id,
      path: "/watchlist/",
      directiveIds: linkedDirectives(item),
      title: `Context watchlist item re-reviewed: ${item.title}`,
      detail:
        `The watched item was read again on ${item.lastReviewedOn} and checked against the Atlas ` +
        `evidence rule, which recorded it as ${boundary.reason ?? "no reason recorded"}.`,
      observedBy: "data",
    });
  });
}

/**
 * Entries the data cannot infer, read from the committed `data/changes.json`.
 *
 * Two things live here and nothing else: a correction to a published record,
 * and the narrowing of a watchlist item — the day the Atlas stopped watching an
 * item because the artifact it was waiting on arrived. Neither leaves a trace
 * in the current data. A promoted item's other half, the evidence record that
 * replaced it, is derived from the sweep log like every other addition, so a
 * promotion produces two entries and each names the other's record.
 */
function committedEntries(changes, { evidenceById, watchlistById }) {
  return (changes?.events ?? []).map((event) => {
    const known = event.kind === "watchlist-narrowed" ? watchlistById : evidenceById;
    if (event.kind === "watchlist-narrowed") {
      requireRecord(known, event.recordId, "a committed watchlist-narrowed event");
      if (event.promotedToEvidenceId) {
        requireRecord(
          evidenceById,
          event.promotedToEvidenceId,
          `the watchlist-narrowed event for ${event.recordId}`,
        );
      }
      const item = watchlistById.get(event.recordId);
      return entry({
        kind: "watchlist-narrowed",
        date: requireDate(event.date, `${event.recordId} narrowed date`),
        recordId: event.recordId,
        path: "/watchlist/",
        directiveIds: linkedDirectives(item),
        title: `Context watchlist item narrowed: ${item.title}`,
        detail: event.promotedToEvidenceId
          ? `${event.note} The artifact this item was watching for is now the evidence record ${event.promotedToEvidenceId}.`
          : event.note,
        observedBy: "data",
      });
    }
    const record = requireRecord(known, event.recordId, "a committed correction event");
    return entry({
      kind: "source-correction-applied",
      date: requireDate(event.date, `${event.recordId} correction date`),
      recordId: event.recordId,
      path: "/corrections/",
      directiveIds: linkedDirectives(record),
      title: `Correction applied: ${record.title}`,
      detail: event.note,
      observedBy: "data",
    });
  });
}

/**
 * One entry per calculated planning date the build date has passed.
 *
 * Dated to the calculated date and not to the build, because the date is in the
 * data: the same commit rebuilt a month later produces the same entry with the
 * same date, and only ever gains the ones the later build date reaches. The
 * wording is the one `lib/directive-timing.mjs` settled on — arithmetic on the
 * order's own language, not a finding about anybody.
 */
function passedDateEntries(directives, buildDate) {
  const entries = [];
  for (const directive of directives) {
    for (const timing of directive.timing ?? []) {
      if (!timingCurrency(timing, buildDate).passed) continue;
      entries.push(
        entry({
          kind: "planning-date-passed",
          date: timing.derivedDate,
          recordId: `${directive.id}:${timing.derivedDate}`,
          path: `/directives/${directive.id}/`,
          directiveIds: [directive.id],
          title: `Calculated planning date reached for ${directive.label}`,
          detail:
            `The Atlas calculates ${timing.derivedDate} from "${timing.sourceText}" for ` +
            `${timing.appliesTo}. That date is now in the past at this build. This is ` +
            "arithmetic on the order's own language and is not a finding about any body.",
          observedBy: "data",
        }),
      );
    }
  }
  return entries;
}

/**
 * The one entry kind dated to the build rather than to the data.
 *
 * A lapse is the absence of a review record, and an absence carries no date of
 * its own. Dating it to the build is the only honest option, and it is why the
 * entry is marked `observedBy: "build"`: a reader syncing the feed can tell
 * which entries will move under them and which will not.
 */
function lapsedReviewEntries(evidence, watchlist, buildDate) {
  const entries = [];
  const evidenceReview = reviewCurrency(
    { id: "evidence-collection", lastReviewedOn: evidence.lastUpdatedOn, nextReviewOn: evidence.nextReviewOn },
    buildDate,
  );
  if (evidenceReview.overdue) {
    entries.push(
      entry({
        kind: "review-date-lapsed",
        date: buildDate,
        recordId: "evidence-collection",
        path: "/evidence/",
        directiveIds: [],
        title: "Planned review date for the evidence layer has passed",
        detail:
          `The evidence layer's planned review date was ${evidence.nextReviewOn}. At this build ` +
          `(${buildDate}) no later review has been recorded, so the coverage statements on the ` +
          "site describe the sources as they stood at the last recorded check.",
        observedBy: "build",
      }),
    );
  }
  for (const item of watchlist.items ?? []) {
    const review = reviewCurrency(item, buildDate);
    if (!review.overdue) continue;
    entries.push(
      entry({
        kind: "review-date-lapsed",
        date: buildDate,
        recordId: item.id,
        path: "/watchlist/",
        directiveIds: linkedDirectives(item),
        title: `Planned review date has passed for a watched item: ${item.title}`,
        detail:
          `The planned review date for this item was ${item.nextReviewOn}. At this build ` +
          `(${buildDate}) the last recorded review is still ${item.lastReviewedOn}.`,
        observedBy: "build",
      }),
    );
  }
  return entries;
}

/**
 * Every change entry the dataset and the build date support, newest first.
 *
 * Ordering is total and does not depend on iteration order anywhere: date
 * descending, then kind, then record id. Two builds of the same commit on the
 * same date produce byte-identical output.
 *
 * @param {object} input
 * @param {Array<object>} input.directives
 * @param {object} input.evidence `data/evidence.json`
 * @param {object} input.watchlist `data/watchlist.json`
 * @param {object} [input.verification] `data/evidence-verification.json`
 * @param {object} [input.changes] `data/changes.json`, the events the data cannot infer
 * @param {string} input.buildDate
 * @returns {ChangeEntry[]}
 */
export function deriveChanges({ directives, evidence, watchlist, verification, changes, buildDate }) {
  requireDate(buildDate, "build date");
  const evidenceById = new Map(evidence.evidence.map((record) => [record.id, record]));
  const watchlistById = new Map((watchlist.items ?? []).map((item) => [item.id, item]));

  const entries = [
    ...sweepEntries(evidence, evidenceById),
    ...evidenceReviewEntries(evidence),
    ...verificationEntries(verification, evidenceById),
    ...watchlistEntries(watchlist),
    ...committedEntries(changes, { evidenceById, watchlistById }),
    ...passedDateEntries(directives, buildDate),
    ...lapsedReviewEntries(evidence, watchlist, buildDate),
  ];

  return entries.sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      left.kind.localeCompare(right.kind) ||
      left.recordId.localeCompare(right.recordId),
  );
}

/** Entries linked to one directive, in the same order the full log uses. */
export function changesForDirective(entries, directiveId) {
  return entries.filter((item) => item.directiveIds.includes(directiveId));
}

const XML_ESCAPES = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&apos;"],
]);

/**
 * Escape a string for XML character data and attribute values alike.
 *
 * One function for both positions, escaping all five predefined entities. A
 * quotation from a publisher's title is the normal input here, and an
 * unescaped ampersand in one of them is a feed no reader can parse at all —
 * which is a worse outcome than any styling question the extra escaping costs.
 */
export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => XML_ESCAPES.get(character));
}

/**
 * Render entries as an Atom 1.0 feed.
 *
 * `updated` is the build date at UTC midnight rather than the current instant,
 * for the reason every other date on this site is: the export is static, so a
 * timestamp in it is a claim the bytes cannot keep. RFC 4287 requires `id`,
 * `title` and `updated` on the feed and on every entry; all five are emitted
 * for each, and `tests/changes.test.mjs` checks the document is well-formed and
 * carries them rather than trusting this function.
 *
 * @param {ChangeEntry[]} entries
 * @param {object} options
 * @param {string} options.siteUrl origin, no trailing slash
 * @param {string} options.selfPath path this feed is served at
 * @param {string} options.title
 * @param {string} options.subtitle
 * @param {string} options.buildDate
 * @returns {string}
 */
export function renderAtom(entries, { siteUrl, selfPath, title, subtitle, buildDate }) {
  requireDate(buildDate, "build date");
  const updated = `${buildDate}T00:00:00Z`;
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${escapeXml(`${siteUrl}${selfPath}`)}</id>`,
    `  <title>${escapeXml(title)}</title>`,
    `  <subtitle>${escapeXml(subtitle)}</subtitle>`,
    `  <updated>${updated}</updated>`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(`${siteUrl}${selfPath}`)}"/>`,
    `  <link rel="alternate" type="text/html" href="${escapeXml(`${siteUrl}/`)}"/>`,
    "  <author><name>Transit Delivery Atlas</name></author>",
    `  <rights>${escapeXml("Independent analysis; unofficial. An entry records what this project did, never what any body did.")}</rights>`,
  ];
  for (const item of entries) {
    lines.push(
      "  <entry>",
      `    <id>${escapeXml(item.id)}</id>`,
      `    <title>${escapeXml(item.title)}</title>`,
      `    <updated>${item.date}T00:00:00Z</updated>`,
      `    <link rel="alternate" type="text/html" href="${escapeXml(`${siteUrl}${item.path}`)}"/>`,
      `    <category term="${escapeXml(item.layer)}" label="${escapeXml(`${item.layer} layer`)}"/>`,
      `    <category term="${escapeXml(item.kind)}"/>`,
      `    <summary type="text">${escapeXml(item.detail)}</summary>`,
      "  </entry>",
    );
  }
  lines.push("</feed>", "");
  return lines.join("\n");
}
