import type { MetadataRoute } from "next";
import changesRaw from "@/data/changes.json";
import directivesRaw from "@/data/directives.json";
import evidenceRaw from "@/data/evidence.json";
import evidenceVerificationRaw from "@/data/evidence-verification.json";
import watchlistRaw from "@/data/watchlist.json";
import { BUILD_DATE } from "@/lib/build-date";
import { deriveChanges } from "@/lib/changes.mjs";
import { routes } from "@/lib/routes";
import { absoluteUrl, servedPath } from "@/lib/site";
import { lastModifiedByRoute } from "@/lib/sitemap-lastmod.mjs";

// Required for `output: "export"`: without this, Next.js treats sitemap.ts as
// a dynamic route and the static export build fails.
export const dynamic = "force-static";

// When each route last changed, from the record-level change log rather than from
// one field on the directive record and rather than from the build. The reasoning
// is in lib/sitemap-lastmod.mjs, next to the code that applies it.
const lastModified = lastModifiedByRoute({
  entries: deriveChanges({
    directives: directivesRaw.directives,
    evidence: evidenceRaw,
    watchlist: watchlistRaw,
    verification: evidenceVerificationRaw,
    changes: changesRaw,
    buildDate: BUILD_DATE,
  }),
  directives: directivesRaw.directives,
});

/**
 * Every route the site serves, read from the same records the pages build their
 * canonical, title and description from. The static half used to be a literal
 * list here under a comment asking whoever edited it to keep it in step with the
 * pages; nothing enforced that, and a page could be added with no sitemap entry
 * or an entry could outlive its page.
 *
 * `<lastmod>` is optional, and an omitted element is a valid sitemap that says
 * nothing false. An element defaulted to the build date would be a claim that
 * every page changed this morning, which is true of the bytes and false of the
 * document.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path }) => {
    const changed = lastModified.get(servedPath(path));
    return changed === undefined
      ? { url: absoluteUrl(path) }
      : { url: absoluteUrl(path), lastModified: changed };
  });
}
