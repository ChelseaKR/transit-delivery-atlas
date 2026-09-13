import type { Metadata } from "next";
import { directives } from "@/lib/data";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  TITLE_TEMPLATE,
  absoluteUrl,
} from "@/lib/site";

/**
 * One record per route the site serves.
 *
 * `app/sitemap.ts` already kept a list of the static paths, under a comment
 * asking whoever edited it to keep it in step with the canonical declared on
 * each page -- a sync nothing enforced. The same list now carries the title and
 * description that used to sit inline in each `page.tsx`, so there is one
 * statement of what a page is called, and the head tags, the sitemap, the
 * breadcrumb trail and the structured data are all readers of it rather than
 * four independent authors.
 *
 * `tests/hosting.test.mjs` derives the expected routes from `app/**\/page.tsx`
 * and compares them against the built sitemap, so a page added without a record
 * here fails the build rather than quietly publishing no title.
 */
export interface RouteRecord {
  /** The canonical path exactly as the page declares it: "/" or "/a" or "/a/b". */
  readonly path: string;
  /**
   * The page's own half of its `<title>`, before the layout's template is
   * applied. `null` on the home page, which is the site and so takes the
   * site's own name rather than a segment of it.
   */
  readonly title: string | null;
  /** `null` where the page inherits the layout's site-wide description. */
  readonly description: string | null;
  /** Only where the record itself records a review date. */
  readonly lastModified?: string;
}

const staticRoutes: readonly RouteRecord[] = [
  { path: "/", title: null, description: null },
  {
    path: "/handoffs",
    title: "Delivery relationships",
    description:
      "Explore bodies and groups explicitly named in California's transit executive order and separately labeled analytical relationships between its directive units.",
  },
  {
    path: "/evidence",
    title: "Public evidence",
    description:
      "Reviewed public artifacts linked to Transit Delivery Atlas directives, with provenance, review dates, and explicit coverage limitations.",
  },
  {
    path: "/watchlist",
    title: "Context watchlist",
    description:
      "Official public developments that are relevant to Transit Delivery Atlas research but do not currently meet the implementation-evidence rule.",
  },
  {
    path: "/research/tda-ntd",
    title: "TDA/NTD reporting feasibility",
    description:
      "A cited four-field comparison of California TDA and National Transit Database reporting, with an explicit automation boundary.",
  },
  {
    path: "/methodology",
    title: "Methodology",
    description:
      "How Transit Delivery Atlas separates signed source language, reviewed public evidence, context-watchlist leads, date calculations, and independent analysis.",
  },
  {
    path: "/accessibility",
    title: "Accessibility",
    description:
      "Accessibility standards, test scope, and known limitations for Transit Delivery Atlas.",
  },
  {
    path: "/data",
    title: "Open data",
    description:
      "Download the Transit Delivery Atlas directive, relationship, public-evidence, and context-watchlist datasets and review their public schemas.",
  },
  {
    path: "/corrections",
    title: "Corrections and review",
    description:
      "Suggest a source-backed correction or share structured review feedback about Transit Delivery Atlas.",
  },
];

/**
 * One record per directive unit, built from the register rather than listed.
 * A directive added to `data/directives.json` gets a route, a sitemap entry and
 * a described page without anyone editing this file.
 */
const directiveRoutes: readonly RouteRecord[] = directives.map((directive) => ({
  path: `/directives/${directive.id}`,
  title: `${directive.label} ${directive.title}`,
  description: `Source-linked record for Executive Order N-7-26, section ${directive.locator.section}, with named entities, timing, public-evidence coverage, separately labeled analysis, and context-watchlist leads when available.`,
  lastModified: directive.lastReviewedOn,
}));

export const routes: readonly RouteRecord[] = [...staticRoutes, ...directiveRoutes];

const routesByPath = new Map(routes.map((route) => [route.path, route] as const));

export function routeFor(path: string): RouteRecord {
  const route = routesByPath.get(path);
  // A page that renders a path with no record would describe itself with an
  // empty name, which reads to a crawler as a described page and is not one.
  if (!route) throw new Error(`No route record for ${path}`);
  return route;
}

/** What the page's `<title>` will say, template applied. */
export function pageTitle(path: string): string {
  const { title } = routeFor(path);
  return title === null ? SITE_NAME : TITLE_TEMPLATE.replace("%s", title);
}

/** What the page's `<meta name="description">` will say, inheritance applied. */
export function pageDescription(path: string): string {
  return routeFor(path).description ?? SITE_DESCRIPTION;
}

export function canonicalUrl(path: string): string {
  return absoluteUrl(routeFor(path).path);
}

/**
 * The metadata a page exports, built from its record.
 *
 * `title` and `description` are omitted where the record inherits them, so
 * Next.js applies the layout's defaults exactly as it did when each page
 * declared nothing.
 */
export function pageMetadata(path: string): Metadata {
  const route = routeFor(path);
  return {
    ...(route.title === null ? {} : { title: route.title }),
    ...(route.description === null ? {} : { description: route.description }),
    alternates: { canonical: route.path },
  };
}

export interface Crumb {
  readonly name: string;
  readonly url: string;
}

/**
 * Where a page sits, derived from the path it is actually at.
 *
 * Walking the segments rather than listing the trail is the whole point: a
 * hand-written trail keeps claiming the old parent after a page moves, and
 * nothing renders the difference. A segment the site does not serve is not a
 * stop -- `/research` and `/directives` are route folders with no page of their
 * own, and a crumb linking to either would be a link to a 404.
 */
export function breadcrumbTrail(path: string): Crumb[] {
  const route = routeFor(path);
  const trail: Crumb[] = [{ name: SITE_NAME, url: absoluteUrl("/") }];

  let prefix = "";
  for (const segment of route.path.split("/").filter(Boolean)) {
    prefix += `/${segment}`;
    const ancestor = routesByPath.get(prefix);
    if (!ancestor) continue;
    trail.push({ name: ancestor.title ?? SITE_NAME, url: absoluteUrl(ancestor.path) });
  }

  return trail;
}
