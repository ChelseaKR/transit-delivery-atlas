import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import {
  PERMITTED_VERDICT_SENTENCES,
  publishedSentences,
  registryKey,
  registryKeysUsed,
  unregisteredVerdictSentences,
} from "../lib/published-language.mjs";

const outDir = new URL("../out/", import.meta.url);

async function exportedPages() {
  const entries = await readdir(outDir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => `${(entry.parentPath ?? entry.path).replace(/\/$/, "")}/${entry.name}`)
    .sort();
}

function relative(filePath) {
  return filePath.replace(outDir.pathname, "").replace(/^\//, "");
}

test("the sweep reads the whole static export, not a sample of it", async () => {
  // A screen that runs over zero pages passes forever. The export has one page
  // per route plus one per directive, so the floor is the twenty-one directive
  // pages and the ten route pages.
  const pages = await exportedPages();

  assert.ok(
    pages.length >= 31,
    `expected the full static export, found ${pages.length} HTML file(s): run the build first`,
  );

  const directivePages = pages.filter((page) => /\/directives\/[^/]+\/index\.html$/.test(page));
  assert.equal(
    directivePages.length,
    21,
    "every directive page must be screened, not a selected few",
  );

  for (const route of ["index.html", "evidence/index.html", "watchlist/index.html"]) {
    assert.ok(
      pages.some((page) => relative(page) === route),
      `${route} must be in the swept set`,
    );
  }
});

test("no exported page publishes a verdict about a directive", async () => {
  const pages = await exportedPages();
  const offences = [];

  for (const page of pages) {
    const html = await readFile(page, "utf8");
    for (const finding of unregisteredVerdictSentences(html)) {
      offences.push(`${relative(page)}\n    ${finding.pattern}\n    ${finding.sentence}`);
    }
  }

  assert.deepEqual(
    offences,
    [],
    `The site published ${offences.length} sentence(s) carrying verdict language with no registered reason.\n\n${offences.join(
      "\n\n",
    )}\n\nEither reword the prose, or, if the sentence disclaims the verdict rather than making one, register it in PERMITTED_VERDICT_SENTENCES with the reason it is not a finding.`,
  );
});

test("no registered exemption outlives the sentence it was written for", async () => {
  const pages = await exportedPages();
  const used = new Set();

  for (const page of pages) {
    for (const key of registryKeysUsed(await readFile(page, "utf8"))) used.add(key);
  }

  const stale = PERMITTED_VERDICT_SENTENCES.map((entry) => entry.sentence).filter(
    (sentence) => !used.has(registryKey(sentence)),
  );

  assert.deepEqual(
    stale,
    [],
    `PERMITTED_VERDICT_SENTENCES exempts ${stale.length} sentence(s) the site no longer publishes. An exemption that outlives its prose is an unreviewed hole; delete it.`,
  );
});

test("every exemption states why it is not a finding", () => {
  for (const { sentence, reason } of PERMITTED_VERDICT_SENTENCES) {
    assert.ok(reason && reason.trim().length > 20, `${sentence} is exempted with no stated reason`);
  }

  const keys = PERMITTED_VERDICT_SENTENCES.map((entry) => registryKey(entry.sentence));
  assert.equal(new Set(keys).size, keys.length, "a sentence is registered twice");
});

test("a verdict published in page prose is caught", () => {
  const html = `<main><p class="analysis">Caltrans is behind schedule on this directive.</p></main>`;
  const [finding, ...rest] = unregisteredVerdictSentences(html);

  assert.equal(rest.length, 0);
  assert.equal(finding.sentence, "Caltrans is behind schedule on this directive.");
});

test("a verdict reaches the screen through any reader-facing surface", () => {
  const surfaces = [
    [`<p>The Commission has not complied with directive 5.</p>`, "body prose"],
    [`<span aria-label="Directive 1(a): no progress since June">1(a)</span>`, "aria-label"],
    [`<img src="/x.png" alt="Chart showing the state is on track" />`, "alt text"],
    [`<abbr title="Caltrans missed the deadline">CT</abbr>`, "title attribute"],
    [`<p>The dashboard <em>is</em> in progress.</p>`, "prose split by an inline tag"],
  ];

  for (const [html, surface] of surfaces) {
    assert.equal(unregisteredVerdictSentences(html).length, 1, `${surface} must be screened`);
  }
});

test("script and style contents are not read as published prose", () => {
  const html = `<script>const label = "is on track";</script><style>.a::after{content:"non-compliant"}</style><p>Directive 1(a) names Caltrans.</p>`;
  assert.deepEqual(unregisteredVerdictSentences(html), []);
});

test("a registered disclaimer is not treated as a verdict", () => {
  const html = `<p>Inclusion documents a source relationship; it does not establish implementation status, completion, compliance, or performance.</p>`;
  assert.deepEqual(unregisteredVerdictSentences(html), []);
});

test("the registry survives the build date moving", () => {
  const key = registryKey("The date the Atlas calculated is behind this build (Aug 28, 2026).");

  assert.equal(
    key,
    registryKey("The date the Atlas calculated is behind this build (Sep 3, 2027)."),
    "a build-relative date must not expire an exemption overnight",
  );
  assert.equal(registryKey("Checked on 2026-08-21."), "Checked on <date>.");
  assert.ok(key.includes("<date>"));
});

test("sentences are read out of block runs, not across them", () => {
  const sentences = publishedSentences(
    `<ul><li>Planning and governance</li><li>Project delivery</li></ul><p>Directive 4 names CalSTA.</p>`,
  );

  assert.ok(sentences.includes("Planning and governance"));
  assert.ok(sentences.includes("Project delivery"));
  assert.ok(sentences.includes("Directive 4 names CalSTA."));
});
