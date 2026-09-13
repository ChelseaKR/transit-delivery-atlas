// `<lastmod>` is the one element in a sitemap that is a claim about the content.
//
// The Atlas published `2026-07-12` on all 21 directive URLs -- one field on the
// directive record, copied 21 times -- while the evidence layer behind those same
// pages had been swept on 2026-09-06. Two months of change the sitemap could not see.
//
// The tempting repair is the build date, because a directive page genuinely
// re-renders every build: `lib/directive-timing.mjs` writes "42 days after the build
// it is published from" and that number moves daily. It is the wrong repair. The
// bytes change; the document does not, and `<lastmod>` is defined on significant
// modification. Every test here is about keeping those two apart -- which is also why
// `observedBy: "build"` entries get a test of their own rather than a comment.

import assert from "node:assert/strict";
import test from "node:test";

import { changeEntry } from "../lib/changes.mjs";
import { datedCoverage, lastModifiedByRoute } from "../lib/sitemap-lastmod.mjs";

const DIRECTIVE = { id: "n-7-26-1a", lastReviewedOn: "2026-07-12" };

/** One change-log entry, built through the module that publishes them. */
function entry(overrides) {
  return changeEntry({
    kind: "evidence-reviewed",
    date: "2026-09-06",
    recordId: "evidence-1",
    path: "/evidence/",
    directiveIds: [],
    title: "Evidence record re-reviewed: a reviewed public artifact",
    detail: "The reviewed artifact and its editorial summary were read again.",
    observedBy: "data",
    ...overrides,
  });
}

test("a route is dated from the newest record that declares it as its path", () => {
  const dates = lastModifiedByRoute({
    entries: [
      entry({ date: "2026-08-21", recordId: "evidence-1" }),
      entry({ date: "2026-09-06", recordId: "evidence-2" }),
      entry({ date: "2026-07-30", recordId: "evidence-3" }),
    ],
    directives: [],
  });

  assert.equal(dates.get("/evidence/"), "2026-09-06");
});

test("a directive route sees a change to a record its page publishes", () => {
  // The defect, in one assertion. The directive record itself was last reviewed on
  // 2026-07-12 and has not moved; an evidence record the page renders was re-reviewed
  // on 2026-09-06. The page changed in September and the old value said July.
  const dates = lastModifiedByRoute({
    entries: [entry({ date: "2026-09-06", directiveIds: [DIRECTIVE.id] })],
    directives: [DIRECTIVE],
  });

  assert.equal(dates.get("/directives/n-7-26-1a/"), "2026-09-06");
});

test("a directive with nothing linked keeps its own review date", () => {
  const dates = lastModifiedByRoute({ entries: [], directives: [DIRECTIVE] });

  assert.equal(dates.get("/directives/n-7-26-1a/"), "2026-07-12");
});

test("a linked record older than the directive's own review does not pull the date back", () => {
  const dates = lastModifiedByRoute({
    entries: [entry({ date: "2026-06-01", directiveIds: [DIRECTIVE.id] })],
    directives: [DIRECTIVE],
  });

  assert.equal(dates.get("/directives/n-7-26-1a/"), "2026-07-12");
});

test("an entry the build observed rather than the data dates nothing", () => {
  // A lapsed review is dated to the build that noticed it. Noticing is not
  // modifying: a rebuild of an unchanged dataset must not move a single date here,
  // or this becomes the build-stamp defect wearing the change log's clothes.
  const lapsed = {
    kind: "review-date-lapsed",
    date: "2026-09-13",
    recordId: "evidence-collection",
    path: "/evidence/",
    directiveIds: [DIRECTIVE.id],
    title: "Planned review date for the evidence layer has passed",
    detail: "No later review has been recorded at this build.",
  };

  const ignored = lastModifiedByRoute({
    entries: [entry({ ...lapsed, observedBy: "build" })],
    directives: [DIRECTIVE],
  });
  assert.equal(ignored.has("/evidence/"), false);
  assert.equal(ignored.get("/directives/n-7-26-1a/"), "2026-07-12");

  // The same entry, differing only in that one field, does date both routes. Without
  // this half the test above passes for any reason at all, including a filter that
  // drops everything.
  const counted = lastModifiedByRoute({
    entries: [entry({ ...lapsed, observedBy: "data" })],
    directives: [DIRECTIVE],
  });
  assert.equal(counted.get("/evidence/"), "2026-09-13");
  assert.equal(counted.get("/directives/n-7-26-1a/"), "2026-09-13");
});

test("a route with no dated record behind it is absent, not defaulted", () => {
  const dates = lastModifiedByRoute({ entries: [], directives: [] });

  assert.equal(dates.has("/methodology/"), false);
  assert.equal(dates.size, 0);
});

test("a directive with no usable review date fails the build", () => {
  assert.throws(
    () =>
      lastModifiedByRoute({
        entries: [],
        directives: [{ id: "n-7-26-1a", lastReviewedOn: "July 2026" }],
      }),
    /no usable lastReviewedOn/,
  );
});

test("coverage reports how many entries are dated of how many there are", () => {
  const coverage = datedCoverage([
    { url: "https://transit.chelseakr.com/", lastModified: "2026-09-06" },
    { url: "https://transit.chelseakr.com/methodology/" },
  ]);

  assert.deepEqual(coverage, { dated: 1, total: 2 });
});
