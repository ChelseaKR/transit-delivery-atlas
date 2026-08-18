import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import {
  passedTimingReport,
  passedTimings,
  timingCurrency,
} from "../lib/directive-timing.mjs";
import { TIMING_PASSED_LABEL, timingCurrencyNote } from "../lib/register-labels.ts";

const root = new URL("../", import.meta.url);
const run = promisify(execFile);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

/**
 * The build date the published bytes were written with. Every currency claim in
 * the markup is a claim about this date, so the rendered assertions are derived
 * from it rather than from the clock the test happens to run on.
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

const timing = {
  sourceText: "Within 120 days of this Order",
  derivedDate: "2026-10-24",
  derivation: "120 calendar days after the effective date",
  appliesTo: "directive action",
};

test("a calculated planning date expires against the reference date", () => {
  assert.equal(timingCurrency(timing, "2026-08-18").passed, false);
  assert.equal(timingCurrency(timing, "2026-08-18").daysUntil, 67);
  assert.equal(timingCurrency(timing, "2026-08-18").daysSince, 0);

  assert.equal(timingCurrency(timing, "2026-10-25").passed, true);
  assert.equal(timingCurrency(timing, "2026-10-25").daysSince, 1);
  assert.equal(timingCurrency(timing, "2026-10-25").daysUntil, 0);

  assert.equal(timingCurrency(timing, "2027-01-01").daysSince, 69);
});

test("the calculated date itself is inside the window, not past it", () => {
  // "Within 120 days" makes the derived date the last day of the window. A
  // build on that day must not tell a reader the date is behind it.
  const sameDay = timingCurrency(timing, "2026-10-24");
  assert.equal(sameDay.passed, false);
  assert.equal(sameDay.daysUntil, 0);
  assert.equal(sameDay.daysSince, 0);
});

test("currency is never computed against an implicit or malformed date", () => {
  assert.throws(
    () => timingCurrency({ derivedDate: "24 Oct 2026" }, "2026-08-18"),
    /must be a real ISO calendar date/,
  );
  assert.throws(
    () => timingCurrency(timing, "2026-02-30"),
    /reference date must be a real ISO calendar date/,
  );
  assert.throws(() => timingCurrency(timing, undefined), /reference date/);
});

test("a passed calculated date is stated as arithmetic, never as a delivery finding", () => {
  const note = timingCurrencyNote(
    timingCurrency(timing, "2026-10-27"),
    "Directive 1(a)",
  );

  assert.match(note, /passed 3 days before the build it is published from \(2026-10-27\)/);
  assert.match(note, /arithmetic on the order’s own language/);
  assert.match(note, /not a finding that this directive is late, incomplete, or out of compliance/);
  assert.match(note, /says nothing about work outside the reviewed public record/);

  for (const forbidden of [/\boverdue\b/i, /\bmissed\b/i, /non-?compliant/i, /\bbehind schedule\b/i]) {
    assert.doesNotMatch(
      note,
      forbidden,
      "a passed planning date must not be labelled with accountability language",
    );
  }
  assert.doesNotMatch(TIMING_PASSED_LABEL, /\boverdue\b|\blate\b|\bmissed\b/i);
});

test("an upcoming calculated date states its distance from the build", () => {
  const note = timingCurrencyNote(timingCurrency(timing, "2026-10-23"), "Directive 1(a)");
  assert.match(note, /is 1 day after the build it is published from \(2026-10-23\)/);
  assert.doesNotMatch(note, /passed/);
});

test("passedTimings reports the canonical dataset in lapse order", async () => {
  const { directives } = await readJson("data/directives.json");

  assert.deepEqual(passedTimings(directives, "2026-06-26"), []);

  const afterFirstCluster = passedTimings(directives, "2026-10-25");
  assert.equal(afterFirstCluster.length, 7, "the 120-day cluster is seven directives");
  assert.deepEqual(
    afterFirstCluster.map(({ label }) => label),
    ["1(a)", "1(b)", "1(c)", "1(d)", "1(e)", "1(f)", "1(g)"],
  );
  assert.ok(afterFirstCluster.every(({ daysSince }) => daysSince === 1));

  const afterAll = passedTimings(directives, "2027-06-27");
  assert.equal(afterAll.length, 8, "the one-year date on 1(e) is the eighth");
  assert.equal(
    afterAll.at(-1).derivedDate,
    "2027-06-26",
    "the most recently lapsed date sorts last",
  );
});

test("a passed calculated date reports without failing the release gate", async () => {
  const { directives } = await readJson("data/directives.json");
  const total = directives.reduce((count, directive) => count + directive.timing.length, 0);

  // Reported, not enforced: a lapsed watchlist review is the Atlas's own upkeep
  // defect and blocks a release, but the calendar arriving is not a defect and
  // must never block a deploy.
  const report = passedTimingReport(passedTimings(directives, "2026-10-25"), total, "2026-10-25");
  assert.match(report, /Calculated planning dates at 2026-10-25: 7 of 8 have passed\./);
  assert.match(report, /1\(a\): calculated 2026-10-24, passed 1 day\(s\) ago/);
  assert.match(report, /It does not fail the gate\./);

  const clean = passedTimingReport([], total, "2026-06-26");
  assert.equal(clean, "Calculated planning dates at 2026-06-26: 0 of 8 have passed.");

  // The gate prints the line on a normal run. A reference date past the
  // calculated dates cannot be exercised end-to-end here, because every
  // watchlist review date in the dataset lapses first and fails the gate for a
  // reason of its own; the enforcement boundary is asserted on the pure
  // functions above.
  const result = await run(process.execPath, ["scripts/validate-data.mjs"], {
    cwd: new URL(".", root),
    env: { ...process.env, ATLAS_BUILD_DATE: "2026-08-04" },
  });
  assert.match(result.stdout, /Calculated planning dates at 2026-08-04: 0 of 8 have passed\./);
  assert.equal(result.stderr.includes("Calculated planning dates"), false);
});

test("no published register cell presents a passed calculated date as forward-looking", async () => {
  const [html, { directives }, buildDate] = await Promise.all([
    readFile(new URL("out/index.html", root), "utf8"),
    readJson("data/directives.json"),
    publishedBuildDate(),
  ]);
  const clean = html.replaceAll("<!-- -->", "");

  for (const directive of directives) {
    for (const item of directive.timing) {
      const currency = timingCurrency(item, buildDate);
      assert.ok(
        clean.includes(timingCurrencyNote(currency, `Directive ${directive.label}`)),
        `directive ${directive.label} must publish the currency of ${item.derivedDate} against the build`,
      );
    }
  }

  const passed = passedTimings(directives, buildDate);
  // Asserted on the flag's markup, not on its words: the register explains the
  // marker in prose on every build, so the label text is present either way.
  assert.equal(
    clean.includes('class="timing-flag"'),
    passed.length > 0,
    "the passed-date flag renders exactly when the dataset has a passed calculated date at this build",
  );

  // The explanation is unconditional, so a build made after the dates pass
  // never introduces an unexplained label.
  assert.match(clean, /Calculated date passed<\/strong> means only that/);
  assert.ok(
    clean.includes(TIMING_PASSED_LABEL),
    "the register must name the marker it explains",
  );
});

test("every directive detail page states the currency of its calculated dates", async () => {
  const [{ directives }, buildDate] = await Promise.all([
    readJson("data/directives.json"),
    publishedBuildDate(),
  ]);

  for (const directive of directives.filter(({ timing }) => timing.length > 0)) {
    const html = await readFile(
      new URL(`out/directives/${directive.id}/index.html`, root),
      "utf8",
    );
    const clean = html.replaceAll("<!-- -->", "");
    for (const item of directive.timing) {
      const note = timingCurrencyNote(
        timingCurrency(item, buildDate),
        `Directive ${directive.label}`,
      );
      assert.ok(clean.includes(note), `${directive.id} must publish the currency of ${item.derivedDate}`);
    }
  }
});
