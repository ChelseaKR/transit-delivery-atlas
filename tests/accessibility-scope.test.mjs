import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, root), "utf8");
}

/** Every route the app actually exports, derived from `app/**\/page.tsx`. */
async function appRoutes(directory = "app", prefix = "") {
  const entries = await readdir(new URL(`${directory}/`, root), {
    withFileTypes: true,
  });
  const routes = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      routes.push(
        ...(await appRoutes(`${directory}/${entry.name}`, `${prefix}/${entry.name}`)),
      );
    } else if (entry.name === "page.tsx") {
      routes.push(prefix === "" ? "/" : prefix);
    }
  }

  return routes.sort();
}

/** Route paths listed in a section of the accessibility document. */
function routesInSection(markdown, heading, nextHeadingPattern) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `docs/ACCESSIBILITY.md must contain "${heading}"`);
  const rest = markdown.slice(start + heading.length);
  const end = rest.search(nextHeadingPattern);
  const section = end === -1 ? rest : rest.slice(0, end);

  return [...section.matchAll(/`(\/[^`]*)`/g)].map((match) => match[1]);
}

test("the accessibility review is dated to a commit", async () => {
  const doc = await readProjectFile("docs/ACCESSIBILITY.md");

  assert.match(
    doc,
    /\*\*Reviewed (\d{4}-\d{2}-\d{2}), at commit `([0-9a-f]{7,40})`\.\*\*/,
    "the evaluation must carry the date and commit it describes",
  );
  assert.doesNotMatch(
    doc,
    /Completed on the current development build/,
    "an undated status re-dates itself with every build",
  );
  assert.match(
    doc,
    /cannot be re-run or reproduced\s+today/,
    "the limit of the record has to be stated, not implied",
  );
});

test("every route is classified as covered or not covered by that review", async () => {
  const [doc, routes] = await Promise.all([
    readProjectFile("docs/ACCESSIBILITY.md"),
    appRoutes(),
  ]);

  const covered = routesInSection(
    doc,
    "### Routes covered by the 2026-07-13 review",
    /^#{2,3} /m,
  );
  const uncovered = routesInSection(
    doc,
    "### Routes not covered by that review",
    /^#{2,3} /m,
  );

  const overlap = covered.filter((route) => uncovered.includes(route));
  assert.deepEqual(overlap, [], "a route cannot be both covered and uncovered");

  for (const route of routes) {
    assert.ok(
      covered.includes(route) || uncovered.includes(route),
      `route ${route} is in neither accessibility list: a new route must not inherit an older evaluation`,
    );
  }

  for (const route of [...covered, ...uncovered]) {
    assert.ok(
      routes.includes(route),
      `docs/ACCESSIBILITY.md claims a scope for ${route}, which the app does not export`,
    );
  }

  assert.ok(uncovered.length > 0, "routes shipped after the review must be listed");
});

test("the published accessibility page states the same dated scope", async () => {
  const [html, doc] = await Promise.all([
    readProjectFile("out/accessibility/index.html"),
    readProjectFile("docs/ACCESSIBILITY.md"),
  ]);
  const page = html.replaceAll("<!-- -->", "");
  const [, reviewedOn, commit] = doc.match(
    /\*\*Reviewed (\d{4}-\d{2}-\d{2}), at commit `([0-9a-f]{7,40})`\.\*\*/,
  );

  assert.ok(
    page.includes(`dateTime="${reviewedOn}"`) || page.includes(`datetime="${reviewedOn}"`),
    "the page must publish the review date in machine-readable form",
  );
  assert.ok(page.includes(commit), "the page must name the reviewed commit");
  assert.doesNotMatch(page, /Completed on the current development build/);

  for (const route of routesInSection(
    doc,
    "### Routes not covered by that review",
    /^#{2,3} /m,
  )) {
    assert.ok(
      page.includes(`<code>${route}</code>`),
      `the page must name ${route} as outside the reviewed scope`,
    );
  }
});
