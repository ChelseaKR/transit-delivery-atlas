import type { Metadata } from "next";
import Link from "next/link";
import { WatchlistCard } from "@/components/WatchlistCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { watchlistItems, watchlistScope } from "@/lib/data";
import { CONTENT_CORRECTION_URL } from "@/lib/feedback";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Context watchlist",
  description:
    "Official public developments that are relevant to Transit Delivery Atlas research but do not currently meet the implementation-evidence rule.",
  alternates: { canonical: "/watchlist" },
};

export default function WatchlistPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="document-page" tabIndex={-1}>
        <header className="document-hero document-hero--watchlist">
          <div className="document-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Research watchlist</p>
            <h1>Public developments under review</h1>
            <p>
              Official sources with topical relevance—or a reasonable chance of
              producing a qualifying artifact—kept visibly outside the evidence
              register.
            </p>
          </div>
        </header>

        <div className="document-shell">
          <nav className="page-index" aria-label="On this page">
            <p className="utility-label">On this page</p>
            <a href="#boundary">Watchlist boundary</a>
            <a href="#items">Items being watched</a>
            <a href="#promotion">Promotion to evidence</a>
            <a href="#corrections">Corrections</a>
          </nav>

          <article className="prose watchlist-catalog">
            <section id="boundary">
              <p className="section-code">Watchlist 01</p>
              <h2>Context, not implementation evidence</h2>
              <p>{watchlistScope.boundaryNote}</p>
              <p>
                The collection scope is{" "}
                <strong>{watchlistScope.scope.replaceAll("-", " ")}</strong>.
                Every item states why it is relevant, why it is outside the
                evidence layer, and what a later review will look for.
              </p>
              <p>
                <strong>Watchlist last reviewed:</strong>{" "}
                <time dateTime={watchlistScope.lastUpdatedOn}>
                  {formatDate(watchlistScope.lastUpdatedOn)}
                </time>
              </p>
              <p>
                The reviewed evidence register remains separate.{" "}
                <Link href="/evidence">See qualifying public evidence</Link>.
              </p>
            </section>

            <section id="items">
              <p className="section-code">Watchlist 02</p>
              <h2>Items being watched</h2>
              <p>
                These records are editorial research leads. A related-directive
                link describes subject matter or a publication checkpoint; it
                does not say the item was caused by the order.
              </p>

              <ul className="watchlist-list">
                {watchlistItems.map((item) => (
                  <li key={item.id}>
                    <WatchlistCard item={item} />
                  </li>
                ))}
              </ul>
            </section>

            <section id="promotion">
              <p className="section-code">Watchlist 03</p>
              <h2>How an item enters the evidence register</h2>
              <p>
                A later artifact must pass the full evidence review: an explicit
                N-7-26 or directive citation, exact locator, provenance and date
                checks, artifact metadata, accessibility note, hash, and
                limitations. The qualifying artifact is added as a new evidence
                record; topical similarity alone is never promoted.
              </p>
              <p>
                When a watchlist item produces qualifying evidence, the current
                lead is removed or narrowed and the transition is recorded in
                the changelog. The evidence record remains independently
                reviewable.
              </p>
              <p>
                <a href="/data/watchlist.json" download>
                  Download the watchlist JSON
                </a>{" "}
                or{" "}
                <a href="/data/watchlist.csv" download>
                  download the watchlist CSV
                </a>
                .
              </p>
            </section>

            <section id="corrections">
              <p className="section-code">Watchlist 04</p>
              <h2>Corrections</h2>
              <p>
                A watchlist correction should identify the item, official URL,
                related directive, current relevance or evidence-boundary
                statement, and the proposed source-backed replacement.
              </p>
              <p>
                <a href={CONTENT_CORRECTION_URL} rel="noreferrer">
                  Suggest a watchlist correction{" "}
                  <span aria-hidden="true">↗</span>
                </a>
              </p>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
