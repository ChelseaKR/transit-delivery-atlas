import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function readProjectFile(path) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("static release metadata identifies the exact build", async () => {
  const version = JSON.parse(await readProjectFile("out/version.json"));
  const expectedSha =
    process.env.BUILD_SHA?.trim() ||
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: fileURLToPath(projectRoot),
      encoding: "utf8",
    }).trim();

  assert.equal(version.sha, expectedSha);
  assert.equal(typeof version.builtAt, "string");
  assert.ok(Number.isFinite(Date.parse(version.builtAt)));
});

test("the exported not-found page is generic and has one noindex directive", async () => {
  const html = await readProjectFile("out/404.html");
  const robotsTags = [...html.matchAll(/<meta[^>]+name="robots"[^>]*>/gi)];

  assert.match(html, /<h1>This page does not exist\.<\/h1>/i);
  assert.equal(robotsTags.length, 1);
  assert.match(robotsTags[0][0], /content="noindex"/i);
  assert.doesNotMatch(robotsTags[0][0], /index,\s*follow/i);
});

test("sitemap lists every static route and every directive record exactly once", async () => {
  const [sitemap, directives] = await Promise.all([
    readProjectFile("out/sitemap.xml"),
    readProjectFile("data/directives.json").then((raw) => JSON.parse(raw).directives),
  ]);

  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(locs).size, locs.length, "sitemap contains a duplicate URL");

  const staticPaths = [
    "/",
    "/handoffs/",
    "/evidence/",
    "/watchlist/",
    "/research/tda-ntd/",
    "/methodology/",
    "/accessibility/",
    "/data/",
    "/corrections/",
  ];
  for (const path of staticPaths) {
    assert.ok(
      locs.includes(`https://transit.chelseakr.com${path}`),
      `sitemap is missing ${path}`,
    );
  }

  for (const directive of directives) {
    assert.ok(
      locs.includes(`https://transit.chelseakr.com/directives/${directive.id}/`),
      `sitemap is missing directive ${directive.id}`,
    );
  }

  assert.equal(locs.length, staticPaths.length + directives.length);
});

test("robots.txt allows crawling and points to the sitemap", async () => {
  const robots = await readProjectFile("out/robots.txt");

  assert.match(robots, /User-Agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/transit\.chelseakr\.com\/sitemap\.xml/);
});

test("CloudFront clean-route function maps pages without rewriting assets", async () => {
  const template = JSON.parse(await readProjectFile("infra/static-site.json"));
  const functionCode = template.Resources.CleanRouteFunction.Properties.FunctionCode;
  const sandbox = {};
  runInNewContext(`${functionCode}\nthis.routeHandler = handler;`, sandbox);

  const rewrite = (uri) => sandbox.routeHandler({ request: { uri } }).uri;
  const cases = new Map([
    ["/", "/index.html"],
    ["/evidence", "/evidence/index.html"],
    ["/evidence/", "/evidence/index.html"],
    ["/watchlist", "/watchlist/index.html"],
    ["/watchlist/", "/watchlist/index.html"],
    ["/handoffs", "/handoffs/index.html"],
    ["/handoffs/", "/handoffs/index.html"],
    ["/research/tda-ntd", "/research/tda-ntd/index.html"],
    ["/research/tda-ntd/", "/research/tda-ntd/index.html"],
    ["/corrections", "/corrections/index.html"],
    ["/corrections/", "/corrections/index.html"],
    ["/directives/n-7-26-5", "/directives/n-7-26-5/index.html"],
    ["/data/directives.json", "/data/directives.json"],
    ["/data/directives.csv", "/data/directives.csv"],
    ["/data/directive-organizations.csv", "/data/directive-organizations.csv"],
    ["/data/directive-relationships.csv", "/data/directive-relationships.csv"],
    ["/data/watchlist.json", "/data/watchlist.json"],
    ["/data/watchlist.csv", "/data/watchlist.csv"],
    ["/data/watchlist-schema.json", "/data/watchlist-schema.json"],
    ["/data/tda-ntd-feasibility.json", "/data/tda-ntd-feasibility.json"],
    ["/og.png", "/og.png"],
    ["/sitemap.xml", "/sitemap.xml"],
    ["/robots.txt", "/robots.txt"],
    ["/deploy-smoke-not-found/", "/deploy-smoke-not-found/index.html"],
  ]);

  for (const [input, expected] of cases) {
    assert.equal(rewrite(input), expected, input);
  }
});
