/**
 * The handful of facts that describe the site itself rather than any one page.
 *
 * These were already stated more than once -- the origin in `app/sitemap.ts`
 * and in `app/layout.tsx`'s `metadataBase`, the site name in three places in
 * the layout's metadata -- and every additional consumer added another copy to
 * keep in step. The structured data would have been the next copy, and the one
 * nobody looks at, so the constants moved here first and the existing writers
 * now read them.
 */

export const SITE_URL = "https://transit.chelseakr.com";

export const SITE_NAME = "Transit Delivery Atlas";

/** The `lang` the root element declares, and so the `inLanguage` of every node. */
export const SITE_LANG = "en";

/**
 * The title template `app/layout.tsx` hands Next.js. Anything that needs to
 * know what a page's `<title>` will actually say applies this same string, so
 * the rendered tag and any derived copy of it cannot disagree about the join.
 */
export const TITLE_TEMPLATE = `%s | ${SITE_NAME}`;

/** The description a page inherits when it declares none of its own. */
export const SITE_DESCRIPTION =
  "Independent, source-linked crosswalk of California Executive Order N-7-26 directives, named entities, timing, reviewed public evidence, context-watchlist leads, dependencies, and open questions.";

export const OG_CARD_PATH = "/og.png";

export const OG_CARD_ALT =
  "Transit Delivery Atlas handoff rail from source to entity, timing, public evidence, and analysis";

/**
 * A canonical path in the form the build actually serves it.
 *
 * `trailingSlash: true` in `next.config.ts` means Next appends a slash to the
 * canonical it renders, so a copy of that path built any other way would differ
 * by one character and be a different URL to a crawler. `lib/sitemap-lastmod.mjs`
 * keys its dates on this form too.
 */
export function servedPath(path: string): string {
  return path === "/" ? "/" : `${path}/`;
}

/** The absolute URL of a path, in the form the build actually serves it. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${servedPath(path)}`;
}
