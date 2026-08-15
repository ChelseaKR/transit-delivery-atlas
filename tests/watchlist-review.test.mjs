import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import { formatDate } from "../lib/format.ts";
import {
  REVIEW_GRACE_DAYS,
  daysBetweenIsoDates,
  overdueReviews,
  reviewCurrency,
  sourceDateCurrency,
} from "../lib/watchlist-review.mjs";

const root = new URL("../", import.meta.url);
const run = promisify(execFile);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

/**
 * The build date the published bytes were written with. Everything the page
 * says about review currency is a claim about this date, so the assertions are
 * derived from it rather than from the clock the test happens to run on.
 */
async function publishedBuildDate() {
  const version = await readJson("out/version.json");
  assert.match(
    version.builtAt,
    /^\d{4}-\d{2}-\d{2}T/,
    "the published build stamp must carry a usable build date",
  );
  return version.builtAt.slice(0, 10);
}

/** Split the rendered watchlist into one HTML fragment per card. */
function watchlistCards(html, items) {
  const clean = html.replaceAll("<!-- -->", "");
  const starts = items.map((item) => {
    const marker = `id="watchlist-${item.id}-title"`;
    const index = clean.indexOf(marker);
    assert.notEqual(index, -1, `card for ${item.id} must render`);
    return index;
  });
  const end = clean.indexOf('id="promotion"');
  assert.ok(end > starts.at(-1), "the item list must end before the promotion section");

  return new Map(
    items.map((item, index) => [
      item.id,
      clean.slice(starts[index], starts[index + 1] ?? end),
    ]),
  );
}

test("a planned review date that has passed is overdue, not merely later than the last review", () => {
  const item = {
    id: "example",
    lastReviewedOn: "2026-07-28",
    nextReviewOn: "2026-08-04",
  };

  const current = reviewCurrency(item, "2026-08-04");
  assert.equal(current.overdue, false, "the planned date itself is still current");
  assert.equal(current.daysOverdue, 0);

  const lapsed = reviewCurrency(item, "2026-08-05");
  assert.equal(lapsed.overdue, true);
  assert.equal(lapsed.daysOverdue, 1);
  assert.equal(lapsed.daysSinceReview, 8);
  assert.equal(lapsed.beyondGrace, false);

  const atGrace = reviewCurrency(item, "2026-08-18");
  assert.equal(atGrace.daysOverdue, REVIEW_GRACE_DAYS);
  assert.equal(atGrace.beyondGrace, false, "the grace window is inclusive");

  const pastGrace = reviewCurrency(item, "2026-08-19");
  assert.equal(pastGrace.daysOverdue, REVIEW_GRACE_DAYS + 1);
  assert.equal(pastGrace.beyondGrace, true);
});

test("review currency refuses to answer for an unusable date", () => {
  assert.throws(
    () =>
      reviewCurrency(
        { id: "example", lastReviewedOn: "2026-07-28", nextReviewOn: "2026-02-30" },
        "2026-08-15",
      ),
    /real ISO calendar date/,
  );
  assert.throws(
    () =>
      reviewCurrency(
        { id: "example", lastReviewedOn: "2026-07-28", nextReviewOn: "2026-08-04" },
        "not-a-date",
      ),
    /real ISO calendar date/,
  );
  assert.equal(daysBetweenIsoDates("2026-08-04", "2026-08-15"), 11);
});

test("a scheduled event that has passed is separated from one still ahead", () => {
  const item = {
    id: "example",
    lastReviewedOn: "2026-07-28",
    nextReviewOn: "2026-08-04",
    sourceDate: { value: "2026-08-03", kind: "scheduled-event", origin: "artifact-header" },
  };

  assert.equal(sourceDateCurrency(item, "2026-08-01").state, "upcoming");
  assert.equal(sourceDateCurrency(item, "2026-08-15").state, "passed-unreviewed");
  assert.equal(
    sourceDateCurrency({ ...item, lastReviewedOn: "2026-08-10" }, "2026-08-15").state,
    "reviewed",
    "an event reviewed after it happened is not an open outcome",
  );
  assert.equal(sourceDateCurrency({ ...item, sourceDate: undefined }, "2026-08-15"), null);
  assert.equal(
    sourceDateCurrency(
      { ...item, sourceDate: { value: "2026-07-27", kind: "published", origin: "page-header" } },
      "2026-08-15",
    ).state,
    "not-scheduled",
  );
});

test("the release gate fails on a review date that has lapsed past the grace window", async () => {
  const watchlist = await readJson("data/watchlist.json");
  const earliest = watchlist.items
    .map(({ nextReviewOn }) => nextReviewOn)
    .sort()
    .at(0);
  const lapsed = new Date(
    new Date(`${earliest}T00:00:00Z`).getTime() + (REVIEW_GRACE_DAYS + 1) * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  await assert.rejects(
    run(process.execPath, ["scripts/validate-data.mjs"], {
      cwd: new URL(".", root),
      env: { ...process.env, ATLAS_BUILD_DATE: lapsed },
    }),
    (error) => {
      assert.match(error.stderr, /past their planned review date/);
      assert.match(error.stderr, /grace window overdue/);
      assert.notEqual(error.code, 0, "a lapsed review must not exit successfully");
      return true;
    },
    "an overdue review date must fail the gate rather than pass silently",
  );

  const current = await run(process.execPath, ["scripts/validate-data.mjs"], {
    cwd: new URL(".", root),
    env: { ...process.env, ATLAS_BUILD_DATE: earliest },
  });
  assert.match(current.stdout, /Watchlist review currency at .*: 0 of \d+ item\(s\)/);
  assert.doesNotMatch(current.stderr, /WATCHLIST REVIEW OVERDUE/);
});

test("no published watchlist card presents a lapsed review as a forward-looking plan", async () => {
  const [html, watchlist, buildDate] = await Promise.all([
    readFile(new URL("out/watchlist/index.html", root), "utf8"),
    readJson("data/watchlist.json"),
    publishedBuildDate(),
  ]);
  const cards = watchlistCards(html, watchlist.items);

  for (const item of watchlist.items) {
    const card = cards.get(item.id);
    const currency = reviewCurrency(item, buildDate);

    assert.match(card, /Last Atlas review/, item.id);
    assert.ok(
      card.includes(formatDate(item.lastReviewedOn)),
      `${item.id} must publish the date it was last reviewed`,
    );

    if (currency.overdue) {
      assert.match(card, /Review overdue/, item.id);
      assert.ok(
        card.includes(`Review due since ${formatDate(item.nextReviewOn)}`),
        `${item.id} must say its review is due, not planned`,
      );
      assert.ok(
        card.includes(`${currency.daysOverdue} day`),
        `${item.id} must publish how far overdue it is`,
      );
      assert.doesNotMatch(
        card,
        /Next planned review/,
        `${item.id} is overdue and must not render as a forward-looking commitment`,
      );
      assert.match(
        card,
        /That review has not happened yet/,
        `${item.id} must not present its watch-for statements as findings`,
      );
    } else {
      assert.match(card, /Next planned review/, item.id);
      assert.doesNotMatch(card, /Review overdue/, item.id);
    }

    const sourceDate = sourceDateCurrency(item, buildDate);
    if (sourceDate?.state === "passed-unreviewed") {
      assert.ok(
        card.includes("The date has passed and the outcome has not been reviewed."),
        `${item.id} must not present a past scheduled event as a plain future date`,
      );
    }
  }
});

test("the watchlist page states its review currency against the build date", async () => {
  const [rawHtml, watchlist, buildDate] = await Promise.all([
    readFile(new URL("out/watchlist/index.html", root), "utf8"),
    readJson("data/watchlist.json"),
    publishedBuildDate(),
  ]);
  const html = rawHtml.replaceAll("<!-- -->", "");
  const overdue = overdueReviews(watchlist.items, buildDate);

  assert.ok(
    html.includes(formatDate(buildDate)),
    "the page must date its own currency claim to the build",
  );

  if (overdue.length > 0) {
    assert.ok(
      html.includes(
        `${overdue.length} of ${watchlist.items.length} items are past their planned review date`,
      ),
      "the page must count its own lapsed reviews",
    );
    for (const { id, daysOverdue } of overdue) {
      assert.ok(
        html.includes(`${id} (${daysOverdue} day`),
        `the page must name ${id} as overdue`,
      );
    }
  } else {
    assert.match(html, /inside its planned review interval when this build was made/);
    assert.doesNotMatch(html, /past their planned review date/);
  }
});
