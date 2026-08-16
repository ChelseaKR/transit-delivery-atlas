import { readFile, stat } from "node:fs/promises";

/**
 * Verify a built release artifact against the canonical data, before anything
 * is published.
 *
 * The post-deploy smoke used to assert record counts as frozen literals
 * ("51 lines", "5 items") after the site was already live, which meant the
 * check fired on a *correct* publish - adding a watchlist item is the expected
 * editorial act - and fired too late to stop anything either way. Every count
 * here is derived from `data/`, so a legitimate edit passes and a truncated,
 * stale, or partially exported artifact fails while the bytes are still sitting
 * in the runner.
 *
 * Usage:
 *   node scripts/verify-release-artifact.mjs [--artifact out] [--expect-sha <sha>]
 */

const root = new URL("../", import.meta.url);

function parseArguments(argv) {
  const options = { artifact: "out", expectSha: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--artifact") options.artifact = argv[++index];
    else if (flag === "--expect-sha") options.expectSha = argv[++index];
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!options.artifact) throw new Error("--artifact requires a directory.");
  return options;
}

const { artifact, expectSha } = parseArguments(process.argv.slice(2));
const artifactRoot = new URL(`${artifact.replace(/\/*$/, "")}/`, root);

const failures = [];
const checks = [];

function record(label, ok, detail) {
  checks.push({ label, ok, detail });
  if (!ok) failures.push(`${label}: ${detail}`);
}

function expectEqual(label, actual, expected, unit) {
  record(
    label,
    actual === expected,
    actual === expected
      ? `${actual} ${unit}`
      : `expected ${expected} ${unit}, artifact has ${actual}`,
  );
}

async function readJson(path, base = root) {
  return JSON.parse(await readFile(new URL(path, base), "utf8"));
}

async function readArtifact(path) {
  return readFile(new URL(path, artifactRoot), "utf8");
}

/**
 * Count CSV records, respecting quoted cells, so a value containing a comma or
 * a newline cannot change the answer the way `wc -l` can.
 *
 * @param {string} text
 * @returns {number} records including the header row
 */
function countCsvRecords(text) {
  let records = 0;
  let quoted = false;
  let started = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
      started = true;
    } else if (character === "\n" && !quoted) {
      if (started) records += 1;
      started = false;
    } else if (character !== "\r") {
      started = true;
    }
  }

  if (started) records += 1;
  return records;
}

async function csvRows(path) {
  return countCsvRecords(await readArtifact(path)) - 1;
}

async function exists(path) {
  try {
    await stat(new URL(path, artifactRoot));
    return true;
  } catch {
    return false;
  }
}

const [directiveData, analysisData, evidenceData, watchlistData, feasibilityData] =
  await Promise.all([
    readJson("data/directives.json"),
    readJson("data/analysis.json"),
    readJson("data/evidence.json"),
    readJson("data/watchlist.json"),
    readJson("data/tda-ntd-feasibility.json"),
  ]);

// Counts derived from the canonical records, never typed in.
const expectedDirectives = directiveData.directives.length;
const expectedEvidence = evidenceData.evidence.length;
const expectedWatchlistItems = watchlistData.items.length;
const expectedSourceRoleLinks = directiveData.directives.reduce(
  (total, directive) =>
    total +
    directive.leadOrgIds.length +
    directive.collaboratorOrgIds.length +
    directive.mentionedOrgIds.length,
  0,
);
const expectedCrossReferences = analysisData.analysis.reduce(
  (total, record) =>
    total +
    record.dependencies.reduce(
      (count, dependency) => count + dependency.relatedDirectiveIds.length,
      0,
    ),
  0,
);
const expectedFeasibilityFields = feasibilityData.fields.length;

const [publishedDirectives, publishedWatchlist, publishedFeasibility] =
  await Promise.all([
    readJson("data/directives.json", artifactRoot),
    readJson("data/watchlist.json", artifactRoot),
    readJson("data/tda-ntd-feasibility.json", artifactRoot),
  ]);

expectEqual(
  "data/directives.json directive records",
  publishedDirectives.directives.length,
  expectedDirectives,
  "records",
);
expectEqual(
  "data/directives.json evidence records",
  publishedDirectives.evidence.length,
  expectedEvidence,
  "records",
);
expectEqual(
  "data/directives.json schema version",
  publishedDirectives.schemaVersion,
  directiveData.schemaVersion,
  "",
);
expectEqual(
  "data/watchlist.json items",
  publishedWatchlist.items.length,
  expectedWatchlistItems,
  "items",
);
expectEqual(
  "data/watchlist.json schema version",
  publishedWatchlist.schemaVersion,
  watchlistData.schemaVersion,
  "",
);
expectEqual(
  "data/tda-ntd-feasibility.json fields",
  publishedFeasibility.fields.length,
  expectedFeasibilityFields,
  "fields",
);
expectEqual(
  "data/tda-ntd-feasibility.json research id",
  publishedFeasibility.researchId,
  feasibilityData.researchId,
  "",
);

expectEqual(
  "data/directives.csv rows",
  await csvRows("data/directives.csv"),
  expectedDirectives,
  "rows",
);
expectEqual(
  "data/evidence.csv rows",
  await csvRows("data/evidence.csv"),
  expectedEvidence,
  "rows",
);
expectEqual(
  "data/watchlist.csv rows",
  await csvRows("data/watchlist.csv"),
  expectedWatchlistItems,
  "rows",
);
expectEqual(
  "data/directive-organizations.csv rows",
  await csvRows("data/directive-organizations.csv"),
  expectedSourceRoleLinks,
  "source-role links",
);
expectEqual(
  "data/directive-relationships.csv rows",
  await csvRows("data/directive-relationships.csv"),
  expectedCrossReferences,
  "analytical cross-references",
);

// Every route the artifact advertises has to exist in the artifact.
const sitemap = await readArtifact("sitemap.xml");
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (match) => new URL(match[1]).pathname,
);
record(
  "sitemap.xml routes",
  routes.length > 0,
  routes.length > 0 ? `${routes.length} routes` : "sitemap advertises no routes",
);
const missingRoutes = [];
for (const route of routes) {
  const file = route === "/" ? "index.html" : `${route.replace(/^\/|\/$/g, "")}/index.html`;
  if (!(await exists(file))) missingRoutes.push(route);
}
record(
  "every advertised route is present",
  missingRoutes.length === 0,
  missingRoutes.length === 0
    ? `${routes.length} routes exported`
    : `missing ${missingRoutes.join(", ")}`,
);

// Disclaimers the site must never publish without. These are content
// invariants rather than counts: they do not move when the data changes.
const contentInvariants = [
  ["index.html", "Independent analysis"],
  ["index.html", "Directive register"],
  ["handoffs/index.html", "A relationship is not a status."],
  ["watchlist/index.html", "Context only · Not implementation evidence"],
  ["evidence/index.html", "Reviewed public evidence"],
  ["404.html", "This page does not exist."],
];
for (const [file, phrase] of contentInvariants) {
  const html = await readArtifact(file).catch(() => "");
  record(`${file} states “${phrase}”`, html.includes(phrase), html ? "present" : "missing");
}

// The artifact must be the build of the commit being released.
const version = await readJson("version.json", artifactRoot);
if (expectSha) {
  expectEqual("version.json build sha", version.sha, expectSha, "");
} else {
  record("version.json build sha", Boolean(version.sha), version.sha ?? "missing");
}

for (const { label, ok, detail } of checks) {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${detail}`);
}

if (failures.length > 0) {
  console.error(
    `\n${failures.length} release-artifact check(s) failed against the canonical data in data/.\nNothing has been published; fix the build rather than the check.`,
  );
  process.exit(1);
}

console.log(
  `\nRelease artifact ${artifact} matches the canonical data: ${expectedDirectives} directives, ${expectedEvidence} evidence record(s), ${expectedWatchlistItems} watchlist item(s), ${expectedSourceRoleLinks} source-role links, ${expectedCrossReferences} analytical cross-references, ${expectedFeasibilityFields} reporting fields.`,
);
