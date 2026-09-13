import type { MetadataRoute } from "next";
import { routes } from "@/lib/routes";
import { absoluteUrl } from "@/lib/site";

// Required for `output: "export"`: without this, Next.js treats sitemap.ts as
// a dynamic route and the static export build fails.
export const dynamic = "force-static";

// Every route the site serves, read from the same records the pages build their
// canonical, title and description from. The static half used to be a literal
// list here under a comment asking whoever edited it to keep it in step with
// the pages; nothing enforced that, and a page could be added with no sitemap
// entry or an entry could outlive its page.
export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, lastModified }) => ({
    url: absoluteUrl(path),
    ...(lastModified ? { lastModified } : {}),
  }));
}
