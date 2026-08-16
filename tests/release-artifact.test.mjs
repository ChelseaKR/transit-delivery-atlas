import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = new URL("../", import.meta.url);
const projectRoot = fileURLToPath(root);
const run = promisify(execFile);

function verify(args = []) {
  return run(process.execPath, ["scripts/verify-release-artifact.mjs", ...args], {
    cwd: projectRoot,
  });
}

/** Give a test its own copy of the built artifact to corrupt. */
async function withArtifactCopy(mutate) {
  const directory = await mkdtemp(join(tmpdir(), "tda-release-artifact-"));
  try {
    await cp(join(projectRoot, "out"), directory, { recursive: true });
    await mutate(directory);
    return await verify(["--artifact", directory]).then(
      (result) => ({ code: 0, ...result }),
      (error) => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("the built artifact matches the counts derived from the canonical data", async () => {
  const { stdout } = await verify();
  assert.match(stdout, /Release artifact out matches the canonical data/);
  assert.doesNotMatch(stdout, /^FAIL/m);
});

test("a record count that disagrees with the data fails before anything is published", async () => {
  const dropped = await withArtifactCopy(async (directory) => {
    const path = join(directory, "data", "directive-organizations.csv");
    const rows = (await readFile(path, "utf8")).trimEnd().split("\n");
    await writeFile(path, `${rows.slice(0, -1).join("\n")}\n`);
  });

  assert.notEqual(dropped.code, 0, "a short export must not verify");
  assert.match(dropped.stdout, /FAIL data\/directive-organizations\.csv rows/);
  assert.match(dropped.stdout, /expected 50 source-role links, artifact has 49/);
  assert.match(dropped.stderr, /Nothing has been published/);

  const shrunkWatchlist = await withArtifactCopy(async (directory) => {
    const path = join(directory, "data", "watchlist.json");
    const watchlist = JSON.parse(await readFile(path, "utf8"));
    watchlist.items = watchlist.items.slice(0, -1);
    await writeFile(path, `${JSON.stringify(watchlist, null, 2)}\n`);
  });

  assert.notEqual(shrunkWatchlist.code, 0);
  assert.match(shrunkWatchlist.stdout, /FAIL data\/watchlist\.json items/);
});

test("a missing route or a dropped disclaimer fails the artifact", async () => {
  const missingRoute = await withArtifactCopy((directory) =>
    rm(join(directory, "watchlist"), { recursive: true, force: true }),
  );
  assert.notEqual(missingRoute.code, 0);
  assert.match(missingRoute.stdout, /FAIL every advertised route is present/);

  const strippedDisclaimer = await withArtifactCopy(async (directory) => {
    const path = join(directory, "handoffs", "index.html");
    const html = await readFile(path, "utf8");
    await writeFile(path, html.replaceAll("A relationship is not a status.", ""));
  });
  assert.notEqual(strippedDisclaimer.code, 0);
  assert.match(strippedDisclaimer.stdout, /FAIL handoffs\/index\.html states/);
});

test("an artifact built from another commit cannot be published as this one", async () => {
  await assert.rejects(
    verify(["--expect-sha", "0000000000000000000000000000000000000000"]),
    (error) => {
      assert.match(error.stdout, /FAIL version\.json build sha/);
      return true;
    },
  );
});

test("the deploy workflow verifies the artifact before it uploads anything", async () => {
  const workflow = await readFile(new URL(".github/workflows/deploy.yml", root), "utf8");

  const verifyStep = workflow.indexOf("scripts/verify-release-artifact.mjs");
  const firstUpload = workflow.indexOf("aws s3 sync");
  const invalidation = workflow.indexOf("aws cloudfront create-invalidation");

  assert.notEqual(verifyStep, -1, "the deploy job must verify the artifact");
  assert.notEqual(firstUpload, -1);
  assert.ok(
    verifyStep < firstUpload && verifyStep < invalidation,
    "artifact verification must run before the release is published, not after",
  );
});

test("the post-deploy smoke asserts no frozen record counts", async () => {
  const workflow = await readFile(new URL(".github/workflows/deploy.yml", root), "utf8");
  const smoke = workflow.slice(workflow.indexOf("Smoke the exact CloudFront release"));

  assert.doesNotMatch(
    smoke,
    /\|\s*length\)\s*==\s*\d+/,
    "a hardcoded record count in the smoke fires on a correct publish, after the site is live",
  );
  assert.doesNotMatch(
    smoke,
    /wc -l[^\n]*\n?[^\n]*=\s*"\d+"/,
    "a hardcoded line count in the smoke fires on a correct publish, after the site is live",
  );
  assert.match(
    smoke,
    /cmp -s/,
    "the smoke should compare the edge to the artifact this run built",
  );
  assert.match(
    workflow,
    /live and suspect/,
    "a failed smoke must say the release is live, because nothing rolls it back",
  );
});
