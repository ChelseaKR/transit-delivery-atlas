#!/usr/bin/env node
// `npm run sweep` — the review sweep the evidence model commits to, done by
// machine as far as a machine can honestly take it.
//
// Reads `data/evidence.json`'s `reviewSources[]` and `data/watchlist.json`'s
// `items[]`, fetches each official URL twice, and prints a worksheet saying
// which sources changed, which could not be retrieved, which have no baseline
// to compare against, and which now mention the order. `--write-draft` also
// writes a patch a reviewer applies by hand.
//
// It writes nothing into `data/`. The layer boundary in AGENTS.md is kept by
// construction here: this program has no code path that edits a record.
//
// Usage:
//   npm run sweep                        # worksheet to stdout, nothing written
//   npm run sweep -- --write-draft       # also writes .sweep/worksheet.md + .sweep/draft.json
//   npm run sweep -- --only <id>[,<id>]  # a subset, by source id
//   npm run sweep -- --swept-on <date>   # override the date stamped on the worksheet
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { CannotSweep, draft, sweep, worksheet } from "../lib/sweep.mjs";
import { isIsoDate } from "./iso-date.mjs";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    console.error(`${name} needs a value`);
    process.exit(2);
  }
  return value;
}

const [evidenceData, watchlistData] = await Promise.all([
  readJson("data/evidence.json"),
  readJson("data/watchlist.json"),
]);

// One list, two kinds, and the kind travels with the row: a review source is an
// index page somebody watches, a watchlist item is a specific document. They are
// swept the same way and must never be reported as the same thing.
const all = [
  ...evidenceData.reviewSources.map((source) => ({ ...source, kind: "review-source" })),
  ...watchlistData.items.map((item) => ({
    id: item.id,
    name: item.title,
    publisher: item.publisher,
    url: item.url,
    lastObservation: item.lastObservation,
    kind: "watchlist-item",
  })),
];

const only = argumentValue("--only");
const selected = only ? all.filter((source) => only.split(",").includes(source.id)) : all;
if (only && selected.length !== only.split(",").length) {
  const missing = only.split(",").filter((id) => !all.some((source) => source.id === id));
  console.error(`--only names ${missing.length} id(s) that are not in the data: ${missing.join(", ")}`);
  process.exit(2);
}

const sweptOn = argumentValue("--swept-on") ?? new Date().toISOString().slice(0, 10);
if (!isIsoDate(sweptOn)) {
  console.error(`--swept-on must be YYYY-MM-DD, got ${sweptOn}`);
  process.exit(2);
}

let run;
try {
  run = await sweep({ sources: selected, sweptOn, fetchImpl: fetch });
} catch (error) {
  if (error instanceof CannotSweep) {
    // Not a finding. A run that could not happen is reported as a run that
    // could not happen, and exits non-zero without writing anything, because
    // the alternative is a worksheet full of `retrieval-failed` that describes
    // this machine rather than the publishers.
    console.error(`The sweep could not run: ${error.message}`);
    process.exit(1);
  }
  throw error;
}

const sheet = worksheet(run);
console.log(sheet);

if (process.argv.includes("--write-draft")) {
  const outputDir = new URL(".sweep/", root);
  await mkdir(outputDir, { recursive: true });
  await writeFile(new URL("worksheet.md", outputDir), sheet);
  await writeFile(new URL("draft.json", outputDir), `${JSON.stringify(draft(run), null, 2)}\n`);
  console.error(
    "\nWrote .sweep/worksheet.md and .sweep/draft.json. Neither is tracked and neither " +
      "has been applied: read the worksheet, then edit data/ by hand.",
  );
}
