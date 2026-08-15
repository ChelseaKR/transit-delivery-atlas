import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The date the published bytes were built, as an ISO calendar date (UTC).
 *
 * The Atlas is exported as static HTML, so any claim about "now" is frozen into
 * the markup at build time. Anything the page says about currency therefore has
 * to be said about the build, not about the reader's clock: a `new Date()` in a
 * client component would silently re-date a claim the markup cannot keep.
 *
 * This module reads the same stamp the deploy smoke check verifies at the edge
 * (`public/version.json`, written by `scripts/write-version.mjs` immediately
 * before `next build`). Importing `node:fs` also means a client component that
 * imports this module fails the build instead of shipping a live clock.
 *
 * Resolution order:
 *   1. `ATLAS_BUILD_DATE` - explicit override, used by the tests.
 *   2. `public/version.json` - the stamp of the build in progress.
 *   3. The current UTC date - `next dev`, which writes no stamp.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fromEnvironment(): string | undefined {
  const value = process.env.ATLAS_BUILD_DATE?.trim();
  if (!value) return undefined;
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(
      `ATLAS_BUILD_DATE must be an ISO calendar date (received ${JSON.stringify(value)}).`,
    );
  }
  return value;
}

function fromVersionStamp(): string | undefined {
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), "public", "version.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }

  const builtAt: unknown = JSON.parse(raw).builtAt;
  if (typeof builtAt !== "string" || !ISO_DATE_PATTERN.test(builtAt.slice(0, 10))) {
    throw new Error(
      `public/version.json has an unusable builtAt value: ${JSON.stringify(builtAt)}.`,
    );
  }
  return builtAt.slice(0, 10);
}

export const BUILD_DATE: string =
  fromEnvironment() ??
  fromVersionStamp() ??
  new Date().toISOString().slice(0, 10);
