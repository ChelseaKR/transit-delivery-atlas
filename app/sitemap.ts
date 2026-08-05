import type { MetadataRoute } from "next";
import { directives } from "@/lib/data";

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

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({
    url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}/`,
  }));

  const directiveEntries: MetadataRoute.Sitemap = directives.map((directive) => ({
    url: `${SITE_URL}/directives/${directive.id}/`,
    lastModified: directive.lastReviewedOn,
  }));

  return [...staticEntries, ...directiveEntries];
}
