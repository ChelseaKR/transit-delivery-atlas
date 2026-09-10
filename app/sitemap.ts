import type { MetadataRoute } from "next";
import { directives } from "@/lib/data";
import { organizationRecords } from "@/lib/organizations";

// Required for `output: "export"`: without this, Next.js treats sitemap.ts as
// a dynamic route and the static export build fails.
export const dynamic = "force-static";

const SITE_URL = "https://transit.chelseakr.com";

// Static, non-directive routes with a stable `alternates.canonical` entry.
// Keep this list in sync with the canonical path declared on each page.
const staticRoutes = [
  "/",
  "/handoffs",
  "/organizations",
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

  // One entry per body or role group. Derived from the same list the pages are
  // generated from, so a registry addition cannot render a page the sitemap
  // does not know about.
  const organizationEntries: MetadataRoute.Sitemap = organizationRecords.map((record) => ({
    url: `${SITE_URL}/organizations/${record.id}/`,
  }));

  return [...staticEntries, ...directiveEntries, ...organizationEntries];
}
