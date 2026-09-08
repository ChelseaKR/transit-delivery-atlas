// A route the changelog announces must be a route the built site serves.
//
// The Atlas's whole argument is that a published claim is checkable against the record
// behind it, and `published-figures.test.mjs` already holds the docs' *numbers* to the
// data. Its `[Unreleased]` section was outside that: it is prose, `.github/workflows/
// quality.yml` runs no job for a docs-only change, and nothing read it back at all.
//
// The defect this was written against was live on `main`. A twenty-line `[Unreleased]`
// entry announced that "**Every body and role group the order names now has its own
// record page**", that "`/organizations` lists the registry alphabetically", and that
// "`organizations.csv` joins the exports" -- while `app/organizations/` did not exist,
// `/organizations` was not in `app/sitemap.ts`, and `public/data/` held no
// `organizations.csv`. The feature is real but it is on an unmerged branch; the entry
// reached `main` through a changelog conflict resolved in the other direction, in a pull
// request whose own diff contained none of it. Both branches were green, because
// `[Unreleased]` prose is not a thing anything read.
//
// That is the same collapse `published-figures.test.mjs` documents for a figure, one
// document further out and one degree worse: a wrong number invites a reader to
// recompute it, and an announced page invites them to visit one that 404s.
//
// **What this gate is and is not.** It resolves against `out/` -- the built artifact, the
// bytes actually served -- rather than against the source tree, for the reason
// `release-artifact.test.mjs` does: a route is a fact about what the export produced, not
// about which files exist. It checks *reachability* and says nothing about whether the
// page contains what the entry claims; a sentence can still be wrong about a page that
// exists. It is the cheap half, and it is the half that was missing.

import assert from "node:assert/strict";
import { globSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const built = new URL("out/", root);

/** The text of one `## [...]` section of the changelog, heading included. */
function section(changelog, heading) {
  const start = changelog.indexOf(heading);
  assert.notEqual(start, -1, `CHANGELOG.md no longer has a ${heading} section`);
  const next = changelog.indexOf("\n## ", start + heading.length);
  return next === -1 ? changelog.slice(start) : changelog.slice(start, next);
}

// A site route, as the changelog writes one: inside backticks, rooted at `/`. A
// documentation path (`app/sitemap.ts`), a field name (`observedBy`) and a data file
// (`data/changes.json`) all lack the leading slash and are not routes, which is why the
// slash carries the whole distinction rather than an exclusion list that would need
// maintaining. `<id>` is the changelog's own placeholder spelling.
const ROUTE_IN_BACKTICKS = /`(\/[A-Za-z0-9][A-Za-z0-9._<>/-]*)`/g;

/** Every distinct route path named in a stretch of changelog prose. */
function routesNamedIn(text) {
  return [...new Set([...text.matchAll(ROUTE_IN_BACKTICKS)].map((match) => match[1]))].sort();
}

/**
 * Does the built artifact serve this route?
 *
 * A `<placeholder>` segment stands for any one segment, so `/directives/<id>/changes.xml`
 * is served when at least one concrete directive has that feed -- which is the claim the
 * sentence makes. Three shapes count as served because the static export writes all
 * three: a file at the path (`/changes.xml`), a directory with an `index.html`
 * (`/evidence`), and a sibling `.html` (`/404`).
 */
function servedBy(artifactRoot, routePath) {
  const relative = routePath.replace(/^\//, "").replaceAll(/<[^>]+>/g, "*");
  if (relative === "") return true; // `/` is the site root
  const patterns = [relative, `${relative}/index.html`, `${relative}.html`];
  return patterns.some(
    (pattern) => globSync(pattern, { cwd: fileURLToPath(artifactRoot) }).length > 0,
  );
}

test("every route the unreleased changelog announces is one the built site serves", async () => {
  const changelog = await readFile(new URL("CHANGELOG.md", root), "utf8");
  const unreleased = section(changelog, "## [Unreleased]");

  // Floor: the gate must be reading a real artifact. An absent or empty `out/` would
  // otherwise make every route unresolvable, or -- worse, if the loop were written the
  // other way -- make the section vacuously clean.
  await assert.doesNotReject(
    stat(new URL("index.html", built)),
    "out/index.html is missing: run `npm run build` before this test, or it is checking nothing",
  );

  // Floor: the resolver must be able to say yes. If `servedBy` silently stopped matching,
  // every route would resolve as unserved and the failure would name the changelog rather
  // than the resolver.
  for (const known of ["/", "/data", "/changes.xml"]) {
    assert.ok(servedBy(built, known), `the resolver cannot find ${known}, which the build writes`);
  }

  const unserved = routesNamedIn(unreleased).filter((route) => !servedBy(built, route));
  assert.deepEqual(
    unserved,
    [],
    `CHANGELOG.md's [Unreleased] section announces ${unserved.length} route(s) the built ` +
      `site does not serve: ${unserved.join(", ")}. Either the entry belongs on the branch ` +
      `that adds the route, or the route was dropped and the entry was not.`,
  );
});

test("the route extractor still finds a route in changelog prose", () => {
  // Without this the regex could stop matching and the gate above would pass over an
  // empty list -- a check that examined nothing, printing the same green line as one that
  // examined everything.
  const prose = [
    "- **Every body has a record page.** `/organizations` lists the registry, and",
    "  `/organizations/<id>` renders one body. See `app/sitemap.ts` and `data/x.json`,",
    "  and the `observedBy` field.",
  ].join("\n");

  assert.deepEqual(routesNamedIn(prose), ["/organizations", "/organizations/<id>"]);
});

test("a route the artifact does not serve is refused", () => {
  // The positive control, against a synthetic artifact rather than the real one, so it
  // keeps meaning the same thing on the day `/organizations` legitimately lands.
  const synthetic = new URL("tests/fixtures/served-artifact/", root);

  assert.ok(servedBy(synthetic, "/evidence"), "the fixture's own route must resolve");
  assert.ok(servedBy(synthetic, "/feed.xml"), "a file-shaped route must resolve");
  assert.ok(servedBy(synthetic, "/records/<id>"), "a placeholder must resolve through a real one");
  assert.ok(!servedBy(synthetic, "/organizations"), "an absent route must NOT resolve");
  assert.ok(!servedBy(synthetic, "/records/<id>/history"), "an absent leaf must NOT resolve");
});
