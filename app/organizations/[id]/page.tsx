import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LayerLabel } from "@/components/LayerLabel";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { formatDate } from "@/lib/format";
import { organizationById, organizationRecords } from "@/lib/organizations";

interface PageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return organizationRecords.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const record = organizationById(id);
  if (!record) return {};
  return {
    title: record.name,
    description: `Everything Executive Order N-7-26 says about ${record.name}, grouped by source-role label with section locators and reviewed excerpts, plus separately labeled analysis and reviewed public evidence published under this name.`,
    alternates: { canonical: `/organizations/${record.id}` },
  };
}

export default async function OrganizationPage({ params }: PageProps) {
  const { id } = await params;
  const record = organizationById(id);
  if (!record) notFound();

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="directive-page" tabIndex={-1}>
        <header className="directive-hero" data-organization-id={record.id}>
          <div className="directive-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="directive-kicker">
              <span>{record.shortName}</span>
              <span>{record.kindLabel}</span>
            </p>
            <h1>{record.name}</h1>
          </div>
        </header>

        <div className="directive-shell">
          <section
            className="record-layer record-layer--source"
            aria-labelledby="organization-source-title"
          >
            <LayerLabel type="source" />
            <h2 id="organization-source-title">What the signed order says about this body</h2>
            <p className="layer-intro">
              Grouped by the source-role label the signed text supports. A label
              records how the order names this body in a directive unit. It does
              not assign an action inside a compound directive, and it is not an
              account of anything anyone has done.
            </p>

            {record.roles.length > 0 ? (
              record.roles.map(({ role, label, appearances }) => (
                // The count is emitted as an attribute as well as in the heading so a
                // test can read what the page renders rather than a regex over prose
                // that a renderer is free to split across text nodes.
                <div
                  className="record-subsection"
                  key={role}
                  data-source-role={role}
                  data-appearances={appearances.length}
                >
                  <h3>
                    {label} ({appearances.length})
                  </h3>
                  <ul className="analysis-list">
                    {appearances.map((appearance) => (
                      <li key={`${role}-${appearance.directiveId}`}>
                        <Link href={`/directives/${appearance.directiveId}`}>
                          {appearance.label} {appearance.title}
                        </Link>
                        <blockquote>“{appearance.excerpt}”</blockquote>
                        <small>
                          Section {appearance.section};{" "}
                          {appearance.pages.length > 1 ? "pages" : "page"}{" "}
                          {appearance.pages.join("–")}
                        </small>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <div className="evidence-empty">
                <p>
                  This body is in the registry and no directive unit in the
                  current release names it. That is a statement about the
                  directive units the Atlas has reviewed, and not a finding
                  about the body.
                </p>
              </div>
            )}
          </section>

          <section
            className="record-layer record-layer--evidence"
            aria-labelledby="organization-evidence-title"
            data-evidence-records={record.evidence.length}
          >
            <LayerLabel type="evidence" />
            <h2 id="organization-evidence-title">
              Reviewed public artifacts published under this name
            </h2>
            <p className="layer-intro">
              Attributed by an exact match between the artifact&apos;s publisher
              field and this registry name. A looser match would hand one body
              another body&apos;s document.
            </p>

            {record.evidence.length > 0 ? (
              <ul className="evidence-list">
                {record.evidence.map((artifact) => (
                  <li key={artifact.id}>
                    <article className="evidence-card">
                      <p className="utility-label">{artifact.publisher}</p>
                      <h3>{artifact.title}</h3>
                      <dl className="record-grid">
                        <div>
                          <dt>Artifact date</dt>
                          <dd>
                            <time dateTime={artifact.datedOn}>
                              {formatDate(artifact.datedOn)}
                            </time>{" "}
                            ({artifact.dateKind})
                          </dd>
                        </div>
                        <div>
                          <dt>Retrieved</dt>
                          <dd>{formatDate(artifact.retrievedOn)}</dd>
                        </div>
                      </dl>
                      <div className="evidence-card__links">
                        <a href={artifact.url} rel="noreferrer">
                          Open public record <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="evidence-empty">
                <p>
                  No reviewed public artifact in the current release carries this
                  body as its publisher. This is a statement about Atlas
                  coverage, and not evidence that no public record exists.
                </p>
              </div>
            )}

            <p className="evidence-method-link">
              <Link href="/evidence">Read the evidence scope and review method</Link>
            </p>
          </section>

          <section
            className="record-layer record-layer--analysis"
            aria-labelledby="organization-analysis-title"
          >
            <LayerLabel type="analysis" />
            <h2 id="organization-analysis-title">Analytical dependency statements</h2>
            <p className="layer-intro">
              Interpretation, written by the Atlas, about directive units this
              body is named as the explicit lead of. These are not official
              assignments, and they are not statements this body has made.
            </p>

            {record.analyticalMentions.length > 0 ? (
              <ul className="analysis-list">
                {record.analyticalMentions.map((mention, index) => (
                  <li key={`${mention.directiveId}-${index}`}>
                    <span>{mention.text}</span>
                    {/* The inference label is the last inline run after the statement,
                        exactly as the directive page renders it. The directive link is a
                        block, so it ends the sentence rather than extending it: the
                        published-language registry is keyed on the sentence, and a page
                        that lengthens an already-reviewed sentence has published a new
                        one that nobody reviewed. */}
                    <small>Inference · {mention.confidence} confidence</small>
                    <p className="related-links">
                      <Link href={`/directives/${mention.directiveId}`}>
                        {mention.label} {mention.title}
                      </Link>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="evidence-empty">
                <p>
                  The analytical layer records no dependency statement on a
                  directive unit this body explicitly leads.
                </p>
              </div>
            )}
          </section>

          {record.watchlist.length > 0 ? (
            <aside
              className="record-layer record-layer--analysis"
              aria-labelledby="organization-context-title"
            >
              <p className="utility-label">Context watchlist</p>
              <h2 id="organization-context-title">Context leads naming this publisher</h2>
              <p className="layer-intro">
                Context, kept apart from the evidence layer on purpose. A
                watchlist item is a lead the Atlas has not reviewed into
                evidence, and it cites nothing about this order by itself.
              </p>
              <ul className="analysis-list">
                {record.watchlist.map((item) => (
                  <li key={item.id}>
                    <span>{item.title}</span>
                    <small>
                      {item.publisher} ·{" "}
                      <Link href="/watchlist">Read the watchlist boundary</Link>
                    </small>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}

          <p className="evidence-method-link">
            <Link href="/organizations">Back to every body and group named in the order</Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
