/**
 * Fail when transit.chelseakr.com is not what this checkout publishes.
 *
 * Every gate here grades the checkout or the runner's own `out/`. `npm run check`
 * grades the source, `verify-release-artifact.mjs` grades the bytes while they are
 * still sitting in the runner, and the deploy job smoke-tests the edge once, in the
 * same run that produced it. After that run ends, nothing has ever looked at the
 * live site again. A deploy that failed halfway through its three S3 syncs, a
 * CloudFront invalidation that did not take, or a `main` whose deploy never fired
 * would leave every gate green while the register a reader downloads described a
 * different set of directives, and nothing in this repository could tell.
 *
 * This is the check for the deployment, run on a schedule rather than once at
 * publish time. It asserts three things:
 *
 *   1. the live /version.json names this commit, so the deployment is not behind
 *      the default branch;
 *   2. the exported data surface under public/data is what scripts/export-data.mjs
 *      produces from data/ right now, so the bytes about to be compared are bytes
 *      the code still stands behind;
 *   3. every published file under public/ is byte-for-byte what the live origin
 *      serves, naming every difference.
 *
 * Usage:
 *   node scripts/verify-live-site.mjs [--origin https://transit.chelseakr.com]
 *                                     [--skip-export] [--minimum 11]
 *
 * WHAT IS DELIBERATELY NOT COMPARED, AND WHY
 *
 * The rendered HTML and the JS chunks under _next/ are excluded, because Next.js
 * mints a random buildId on every build and stamps it into nearly every exported
 * file. Two builds of the same commit therefore differ, so byte equality over the
 * export would be a check that fails for a reason that is not drift. That is a
 * moving target, and forcing byte equality on one produces noise rather than
 * signal. What is left is not nothing: public/ is the whole machine-readable
 * surface, the register and the evidence and the watchlist, which is what anybody
 * consuming this site actually downloads, and /version.json pins the commit the
 * HTML was built from.
 *
 * Pinning `generateBuildId` in next.config.ts would make the HTML comparable too.
 * That is a real change to what gets deployed, so it is not made here.
 *
 * Exit codes: 0 the live site is this commit's site, 1 it is not, 4 the check
 * could not run.
 */

import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const DEFAULT_ORIGIN = "https://transit.chelseakr.com";
const PUBLISHED_DIR = "public";

/**
 * public/version.json is written at build time and carries the moment of the
 * build, so it is checked as a record rather than compared as bytes. It is also
 * gitignored, so it never appears in the tracked inventory in the first place.
 */
const CHECKED_AS_A_RECORD = new Set(["version.json"]);

/**
 * The floor under the comparison set. A sentinel that finds nothing to compare and
 * prints OK is worse than no sentinel, so a set smaller than this is a failure.
 * Eleven files are published today: nine data artifacts and the share card.
 */
const MINIMUM_FILES = 11;

const EXIT_DIFFERS = 1;
const EXIT_CANNOT_RUN = 4;

class CannotRun extends Error {}

function parseArguments(argv) {
  const options = { origin: DEFAULT_ORIGIN, skipExport: false, minimum: MINIMUM_FILES };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--origin") options.origin = argv[++index];
    else if (flag === "--skip-export") options.skipExport = true;
    else if (flag === "--minimum") options.minimum = Number(argv[++index]);
    else throw new CannotRun(`Unknown argument: ${flag}`);
  }
  const parsed = new URL(options.origin);
  if (parsed.protocol !== "https:") throw new CannotRun(`${options.origin} is not HTTPS`);
  if (!Number.isInteger(options.minimum) || options.minimum < 1) {
    throw new CannotRun("--minimum must be a positive integer");
  }
  options.origin = options.origin.replace(/\/+$/, "");
  return options;
}

function shortDigest(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function git(...args) {
  return execFileSync("git", args, { cwd: fileURLToPath(root), encoding: "utf8" }).trim();
}

async function fetchLive(origin, path, token) {
  const url = `${origin}/${path}?live-integrity=${token}`;
  let response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      headers: { "cache-control": "no-cache, no-store, max-age=0", pragma: "no-cache" },
    });
  } catch (error) {
    throw new CannotRun(`GET ${url} failed: ${error.message}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  return { status: response.status, body };
}

/** A host that answers everything with 200 makes every comparison vacuous. */
async function proveTheOriginDiscriminates(origin, token) {
  const missing = `.live-integrity-guaranteed-missing-${token}`;
  const { status } = await fetchLive(origin, missing, token);
  if (status !== 404) {
    throw new CannotRun(
      `the origin answered a guaranteed-missing path with HTTP ${status} instead of ` +
        `404, so a matching fetch would prove nothing: /${missing}`,
    );
  }
}

/** The deployment has to name the commit this check ran against. */
async function deployedCommit(origin, token) {
  const { status, body } = await fetchLive(origin, "version.json", token);
  if (status !== 200) throw new CannotRun(`/version.json returned HTTP ${status}`);
  let record;
  try {
    record = JSON.parse(body.toString("utf8"));
  } catch (error) {
    throw new CannotRun(`/version.json is not JSON: ${error.message}`);
  }
  if (typeof record.sha !== "string" || !/^[0-9a-f]{40}$/.test(record.sha)) {
    throw new CannotRun(`/version.json carries sha ${JSON.stringify(record.sha)}`);
  }
  const builtAt = Date.parse(record.builtAt);
  if (Number.isNaN(builtAt)) {
    throw new CannotRun(`/version.json carries builtAt ${JSON.stringify(record.builtAt)}`);
  }
  if (builtAt > Date.now() + 60_000) {
    throw new CannotRun(`/version.json says it was built at ${record.builtAt}, in the future`);
  }
  return record;
}

/** Refuse to compare a committed data surface the exporter no longer produces. */
function regenerateTheDataSurface() {
  try {
    execFileSync("node", ["scripts/export-data.mjs"], {
      cwd: fileURLToPath(root),
      stdio: "pipe",
    });
  } catch (error) {
    throw new CannotRun(
      `scripts/export-data.mjs failed, so the committed data surface is not what the ` +
        `code produces and there is nothing trustworthy to compare:\n${error.stderr ?? error.message}`,
    );
  }
  const moved = git("status", "--porcelain", "--", `${PUBLISHED_DIR}/data`);
  if (moved) {
    throw new CannotRun(
      `re-exporting changed the committed data surface, so the deployment is not the ` +
        `question yet. Run \`npm run data:export\` and commit it:\n${moved}`,
    );
  }
}

function publishedInventory() {
  const tracked = git("ls-files", "--", PUBLISHED_DIR)
    .split("\n")
    .filter(Boolean)
    .map((entry) => entry.slice(PUBLISHED_DIR.length + 1))
    .filter((relative) => !CHECKED_AS_A_RECORD.has(relative));
  return tracked.sort();
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const token = randomBytes(16).toString("hex");
  const differences = [];
  let inventory;
  let version;
  let total = 0;

  await proveTheOriginDiscriminates(options.origin, token);
  version = await deployedCommit(options.origin, token);
  const head = git("rev-parse", "HEAD");
  if (version.sha !== head) {
    differences.push(
      `/version.json: the live site was built from ${version.sha} at ${version.builtAt}, ` +
        `not from ${head}, the commit this check ran against`,
    );
  }
  if (!options.skipExport) regenerateTheDataSurface();

  inventory = publishedInventory();
  if (inventory.length < options.minimum) {
    throw new CannotRun(
      `the comparison set holds ${inventory.length} file(s), below the floor of ` +
        `${options.minimum}. A check that compares nothing must fail, not pass.`,
    );
  }

  for (const relative of inventory) {
    const expected = await readFile(new URL(`${PUBLISHED_DIR}/${relative}`, root));
    total += expected.length;
    const { status, body } = await fetchLive(options.origin, relative, token);
    if (status !== 200) {
      differences.push(
        `${relative}: the live origin returned HTTP ${status}; this checkout ` +
          `publishes ${expected.length} bytes`,
      );
      continue;
    }
    if (!body.equals(expected)) {
      differences.push(
        `${relative}: live sha256 ${shortDigest(body)} (${body.length} bytes) is not ` +
          `the published ${shortDigest(expected)} (${expected.length} bytes)`,
      );
    }
  }

  if (differences.length > 0) {
    console.error(`The live site at ${options.origin} is not what this checkout publishes.`);
    for (const difference of differences) console.error(`  ${difference}`);
    console.error("\nRe-run Deploy, or find out why the deployment is behind main.");
    return EXIT_DIFFERS;
  }

  console.log(
    `${options.origin} serves exactly what this checkout publishes: ` +
      `${inventory.length} file(s), ${total} bytes, built from ${version.sha} at ${version.builtAt}.`,
  );
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  if (error instanceof CannotRun) {
    console.error(`live integrity check could not run: ${error.message}`);
    process.exitCode = EXIT_CANNOT_RUN;
  } else {
    throw error;
  }
}
