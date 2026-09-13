import { ogCard } from "@/lib/og-card";
import {
  breadcrumbTrail,
  canonicalUrl,
  pageDescription,
  pageTitle,
} from "@/lib/routes";
import {
  OG_CARD_ALT,
  OG_CARD_PATH,
  SITE_LANG,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site";

/**
 * A schema.org description of what a page is and where it sits.
 *
 * Every value is read back out of the record the page's own head is rendered
 * from: the node's `name` is the `<title>`, its `description` is the
 * `<meta name="description">`, its `url` is the canonical, and the trail is
 * walked from the path the page is actually at. Nothing here is typed twice,
 * because the copy nobody reads is the copy that rots -- a title changed in one
 * place and not the other publishes two answers to "what is this page", and the
 * wrong one is the one a search result shows.
 *
 * What is deliberately absent matters as much as what is here.
 *
 * There is no `Dataset`, no `DataCatalog`, no `distribution`, and no DCAT or
 * VoID vocabulary. Those are not descriptions; they are invitations. A dataset
 * descriptor exists so that dataset search engines and open-data catalogs
 * harvest the thing it names and list it as a dataset of record, and a catalog
 * listing is far easier to acquire than to withdraw. This site is an explicitly
 * unofficial reading of a signed state order, and whether an unofficial model of
 * a government instrument should solicit that indexing is an open question with
 * an owner's name on it, not a line someone adds quietly.
 *
 * There is no per-directive node either -- no `Legislation`, no
 * `GovernmentService`, no `Action`, no `Claim`. A machine-readable record for
 * each directive, repeated across thirty pages, is a derived corpus of
 * government material published for harvest whatever its `@type` says, and it
 * would also read as the State of California publishing it. The site says on
 * every page that it is not that. Saying "this page is a page of this site, and
 * here is where it sits" asks for none of it, and is all this says.
 *
 * No `Organization` node, for a narrower reason: nothing on the site names a
 * publisher. Inventing one to fill the slot would publish an entity that does
 * not exist, and naming one of the public bodies the content discusses would
 * imply exactly the official authorship the site disclaims.
 */
export function pageGraph(path: string) {
  const url = canonicalUrl(path);
  const siteId = `${absoluteUrl("/")}#website`;
  const pageId = `${url}#webpage`;
  const breadcrumbId = `${url}#breadcrumb`;
  const cardId = `${SITE_URL}${OG_CARD_PATH}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": siteId,
        url: absoluteUrl("/"),
        name: SITE_NAME,
        inLanguage: SITE_LANG,
      },
      {
        "@type": "WebPage",
        "@id": pageId,
        url,
        name: pageTitle(path),
        description: pageDescription(path),
        inLanguage: SITE_LANG,
        isPartOf: { "@id": siteId },
        breadcrumb: { "@id": breadcrumbId },
        primaryImageOfPage: { "@id": cardId },
      },
      {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId,
        itemListElement: breadcrumbTrail(path).map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.url,
        })),
      },
      {
        "@type": "ImageObject",
        "@id": cardId,
        url: cardId,
        width: ogCard.width,
        height: ogCard.height,
        caption: OG_CARD_ALT,
      },
    ],
  };
}

/**
 * The graph as the bytes that go into the element.
 *
 * `</script` inside a JSON string closes the element as far as an HTML parser
 * is concerned, whatever JSON thinks of it. Escaping the three characters that
 * can begin markup keeps the block inert without changing what it decodes to,
 * which is all any consumer of this actually reads.
 */
export function structuredData(path: string): string {
  return JSON.stringify(pageGraph(path))
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}
