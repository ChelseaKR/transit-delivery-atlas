import type { MetadataRoute } from "next";

// Required for `output: "export"`: without this, Next.js treats robots.ts as
// a dynamic route and the static export build fails.
export const dynamic = "force-static";

const SITE_URL = "https://transit.chelseakr.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
