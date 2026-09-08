import { mkdir, readFile, writeFile } from "node:fs/promises";
import { changesForDirective, deriveChanges, renderAtom } from "../lib/changes.mjs";
import { isIsoDate } from "./iso-date.mjs";

/**
 * Write the record-level change log and the Atom feeds into `public/`.
 *
 * Run between `write-version.mjs` and `next build`, for the same reason
 * `public/version.json` is written there: the build date is a build-time fact,
 * so the artifacts that depend on it are build artifacts and are gitignored.
 * Everything else this project exports is committed and gated by
 * `data:export:check`; these files are not, and the difference is the build
 * date, which is the one input a committed file cannot pin.
 *
 * The build date is resolved the same way `lib/build-date.ts` resolves it, and
 * deliberately not with `new Date()` as a fallback in CI: a feed dated to the
 * runner's clock while the pages beside it are dated to the version stamp would
 * publish two different "now"s in one build.
 */

const root = new URL("../", import.meta.url);
const SITE_URL = "https://transit.chelseakr.com";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

async function buildDate() {
  const override = process.env.ATLAS_BUILD_DATE?.trim();
  if (override) {
    if (!isIsoDate(override)) {
      throw new Error(
        `ATLAS_BUILD_DATE must be an ISO calendar date (received ${JSON.stringify(override)}).`,
      );
    }
    return override;
  }
  const stamp = JSON.parse(await readFile(new URL("public/version.json", root), "utf8"));
  const date = String(stamp.builtAt).slice(0, 10);
  if (!isIsoDate(date)) {
    throw new Error(`public/version.json has an unusable builtAt value: ${stamp.builtAt}.`);
  }
  return date;
}

const [directiveData, evidence, watchlist, verification, changes] = await Promise.all([
  readJson("data/directives.json"),
  readJson("data/evidence.json"),
  readJson("data/watchlist.json"),
  readJson("data/evidence-verification.json"),
  readJson("data/changes.json"),
]);

const date = await buildDate();
const entries = deriveChanges({
  directives: directiveData.directives,
  evidence,
  watchlist,
  verification,
  changes,
  buildDate: date,
});

const publicDir = new URL("public/", root);

const log = {
  schemaVersion: "0.1.0",
  builtOn: date,
  note:
    "Dated, record-level events derived from the committed data and this build's date. An entry " +
    "records what the Atlas did, never what any body did. observedBy is 'data' when the entry's " +
    "date comes from the dataset and 'build' when it is this build's own observation of an " +
    "absence, which is the only kind of entry that moves when an unchanged dataset is rebuilt.",
  entries,
};

const written = new Map([
  ["changes.json", `${JSON.stringify(log, null, 2)}\n`],
  [
    "changes.xml",
    renderAtom(entries, {
      siteUrl: SITE_URL,
      selfPath: "/changes.xml",
      title: "Transit Delivery Atlas — record changes",
      subtitle:
        "Dated, record-level events across the source, evidence, analysis, and context layers. Independent analysis; unofficial.",
      buildDate: date,
    }),
  ],
]);

for (const directive of directiveData.directives) {
  written.set(
    `directives/${directive.id}/changes.xml`,
    renderAtom(changesForDirective(entries, directive.id), {
      siteUrl: SITE_URL,
      selfPath: `/directives/${directive.id}/changes.xml`,
      title: `Transit Delivery Atlas — ${directive.label} record changes`,
      subtitle: `Dated, record-level events linked to directive ${directive.label}. Independent analysis; unofficial.`,
      buildDate: date,
    }),
  );
}

await Promise.all(
  [...written].map(async ([name, content]) => {
    const target = new URL(name, publicDir);
    await mkdir(new URL(".", target), { recursive: true });
    await writeFile(target, content);
  }),
);

console.log(
  `Wrote ${entries.length} change entries at build date ${date}: public/changes.json, ` +
    `public/changes.xml, and ${directiveData.directives.length} per-directive feed(s).`,
);
