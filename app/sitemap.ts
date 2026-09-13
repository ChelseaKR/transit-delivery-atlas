import type { MetadataRoute } from "next";
import changesRaw from "@/data/changes.json";
import directivesRaw from "@/data/directives.json";
import evidenceRaw from "@/data/evidence.json";
import evidenceVerificationRaw from "@/data/evidence-verification.json";
import watchlistRaw from "@/data/watchlist.json";
import { BUILD_DATE } from "@/lib/build-date";
import { deriveChanges } from "@/lib/changes.mjs";
import { lastModifiedByRoute } from "@/lib/sitemap-lastmod.mjs";

// Required for `output: "export"`: without this, Next.js treats sitemap.ts as
// a dynamic route and the static export build fails.
export const dynamic = "force-static";

const SITE_URL = "https://transit.chelseakr.com";

// Static, non-directive routes with a stable `alternates.canonical` entry.
// Keep this list in sync with the canonical path declared on each page.
const staticRoutes = [
  "/",
  "/handoffs",
  "/evidence",
  "/watchlist",
  "/research/tda-ntd",
  "/methodology",
  "/accessibility",
  "/data",
  "/corrections",
];

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
 * One sitemap entry, carrying a `<lastmod>` only where a dated record supports one.
 *
 * `<lastmod>` is optional, and an omitted element is a valid sitemap that says
 * nothing false. An element defaulted to the build date would be a claim that every
 * page changed this morning, which is true of the bytes and false of the document.
 */
function entry(url: string, route: string): MetadataRoute.Sitemap[number] {
  const changed = lastModified.get(route);
  return changed === undefined ? { url } : { url, lastModified: changed };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => {
    const route = path === "/" ? "/" : `${path}/`;
    return entry(`${SITE_URL}${route}`, route);
  });

  const directiveEntries: MetadataRoute.Sitemap = directivesRaw.directives.map((directive) => {
    const route = `/directives/${directive.id}/`;
    return entry(`${SITE_URL}${route}`, route);
  });

  return [...staticEntries, ...directiveEntries];
}
