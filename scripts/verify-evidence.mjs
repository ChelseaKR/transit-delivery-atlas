/**
 * Re-hash every cited evidence artifact against the register's stored hash.
 *
 * `data/evidence.json` records a `sha256` for each artifact so a quotation from
 * it can be checked against the publisher's own file. Nothing re-checked that
 * hash after the review, so link rot or a silent re-issue would leave the
 * register asserting a relationship to bytes that no longer exist while every
 * gate stayed green. This is that check, run by hand before a release and
 * committed as `data/evidence-verification.json`.
 *
 * Nothing is edited automatically. A record whose artifact is gone is disclosed,
 * not deleted, and its review date is not moved: `--draft-limitations` prints the
 * sentence such a record would carry, for a person to read and paste.
 *
 * Usage:
 *   node scripts/verify-evidence.mjs [--out data/evidence-verification.json]
 *                                    [--timeout-ms 30000] [--draft-limitations]
 *                                    [--no-write]
 *
 * Exit codes: 0 every artifact intact and every context URL reachable, 1 any
 * artifact changed, moved, or gone (or a context URL moved or gone), 2 the check
 * could not run — including when nothing on the network answered, in which case
 * no log is written, because an unreachable machine is not a finding about a
 * public body's website.
 */

import { readFile, writeFile } from "node:fs/promises";
import {
  CannotVerify,
  draftLimitation,
  failures,
  report,
  verifyEvidence,
} from "../lib/evidence-verification.mjs";
import { isIsoDate } from "./iso-date.mjs";

const root = new URL("../", import.meta.url);

const DEFAULT_OUT = "data/evidence-verification.json";
const EXIT_DRIFT = 1;
const EXIT_CANNOT_RUN = 2;

function parseArguments(argv) {
  const options = {
    out: DEFAULT_OUT,
    timeoutMs: 30_000,
    draftLimitations: false,
    write: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--out") options.out = argv[++index];
    else if (flag === "--timeout-ms") options.timeoutMs = Number(argv[++index]);
    else if (flag === "--draft-limitations") options.draftLimitations = true;
    else if (flag === "--no-write") options.write = false;
    else throw new CannotVerify(`Unknown argument: ${flag}`);
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new CannotVerify("--timeout-ms must be a positive number of milliseconds.");
  }
  return options;
}

/**
 * The date the log is stamped with. `ATLAS_BUILD_DATE` keeps a run reproducible,
 * the same override `scripts/validate-data.mjs` already honours.
 */
function checkedOnDate() {
  const override = process.env.ATLAS_BUILD_DATE?.trim();
  if (!override) return new Date().toISOString().slice(0, 10);
  if (!isIsoDate(override)) {
    throw new CannotVerify(
      `ATLAS_BUILD_DATE must be a real ISO calendar date (received ${JSON.stringify(override)}).`,
    );
  }
  return override;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const evidenceData = JSON.parse(await readFile(new URL("data/evidence.json", root), "utf8"));

  const log = await verifyEvidence({
    records: evidenceData.evidence,
    checkedOn: checkedOnDate(),
    fetchImpl: globalThis.fetch,
    timeoutMs: options.timeoutMs,
  });

  console.log(report(log));

  if (options.write) {
    await writeFile(new URL(options.out, root), `${JSON.stringify(log, null, 2)}\n`);
    console.log(`Wrote ${options.out}. Commit it: the site renders its dates.`);
  }

  const drift = failures(log);
  if (drift.length === 0) return 0;

  console.error(`\n${drift.length} URL(s) no longer resolve to what this register reviewed:`);
  for (const item of drift) {
    console.error(`  ${item.id} (${item.kind}) ${item.outcome}: ${item.detail}`);
  }
  if (options.draftLimitations) {
    console.error("\nDraft limitation text (review it, then paste it by hand):");
    for (const record of log.records) {
      const drafted = draftLimitation(record, log.checkedOn);
      if (drafted) console.error(`  ${record.id}\n    ${drafted}`);
    }
  } else {
    console.error("\nRe-run with --draft-limitations for the sentence each record would carry.");
  }
  return EXIT_DRIFT;
}

try {
  process.exitCode = await main();
} catch (error) {
  if (error instanceof CannotVerify) {
    console.error(`evidence link-integrity check could not run: ${error.message}`);
    process.exitCode = EXIT_CANNOT_RUN;
  } else {
    throw error;
  }
}
