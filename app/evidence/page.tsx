import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  directiveById,
  evidenceRecords,
  evidenceScope,
} from "@/lib/data";
import { CONTENT_CORRECTION_URL } from "@/lib/feedback";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Public evidence",
  description:
    "Reviewed public artifacts linked to Transit Delivery Atlas directives, with provenance, review dates, and explicit coverage limitations.",
  alternates: { canonical: "/evidence" },
};

export default function EvidencePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="document-page" tabIndex={-1}>
        <header className="document-hero document-hero--evidence">
          <div className="document-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Reviewed public evidence</p>
            <h1>Public artifacts, linked with limits.</h1>
            <p>
              A selective collection of dated public records connected to the
              signed directives, with provenance, review dates, and caveats kept
              visible.
            </p>
          </div>
        </header>

        <div className="document-shell">
          <nav className="page-index" aria-label="On this page">
            <p className="utility-label">On this page</p>
            <a href="#scope">Evidence scope</a>
            <a href="#records">Reviewed artifacts</a>
            <a href="#meaning">What a link means</a>
            <a href="#corrections">Corrections</a>
          </nav>

          <article className="prose evidence-catalog">
            <section id="scope">
              <p className="section-code">Evidence 01</p>
              <h2>A curated public-record layer</h2>
              <p>{evidenceScope.coverageNote}</p>
              <p>
                The collection scope is <strong>{evidenceScope.scope}</strong>.
                Records are added only after their public source, directive
                relationship, locator, and limitations are reviewed.
              </p>
              <p>
                <strong>Evidence collection last updated:</strong>{" "}
                <time dateTime={evidenceScope.lastUpdatedOn}>
                  {formatDate(evidenceScope.lastUpdatedOn)}
                </time>
              </p>
              <p>
                <a
                  href="https://chelseakr.com/writing/signed-transit-order-start"
                  rel="noreferrer"
                >
                  Read “A Signed Transit Order Is the Start of the Story, Not the End”
                </a>{" "}
                for the public-interest rationale behind this layer.
              </p>
            </section>

            <section id="records">
              <p className="section-code">Evidence 02</p>
              <h2>Reviewed public artifacts</h2>
              <p>
                Each card states what the public record documents and why the
                Atlas links it to a directive. A scheduled date is presented as
                scheduled unless a later public record supports different wording.
              </p>

              <ul className="evidence-list evidence-list--catalog">
                {evidenceRecords.map((record) => (
                  <li key={record.id}>
                    <article
                      className="evidence-card"
                      aria-labelledby={`evidence-catalog-${record.id}-title`}
                    >
                      <p className="utility-label">Reviewed public artifact</p>
                      <h3 id={`evidence-catalog-${record.id}-title`}>{record.title}</h3>

                      <dl className="evidence-meta">
                        <div>
                          <dt>Record type</dt>
                          <dd>{record.evidenceType.replaceAll("-", " ")}</dd>
                        </div>
                        <div>
                          <dt>Publisher</dt>
                          <dd>{record.publisher}</dd>
                        </div>
                        <div>
                          <dt>Date shown in record</dt>
                          <dd>
                            <time dateTime={record.datedOn}>{formatDate(record.datedOn)}</time>
                            {record.dateKind === "scheduled-event" ? (
                              <span>Scheduled event date</span>
                            ) : null}
                          </dd>
                        </div>
                        <div>
                          <dt>Atlas review</dt>
                          <dd>
                            <time dateTime={record.lastReviewedOn}>
                              {formatDate(record.lastReviewedOn)}
                            </time>
                          </dd>
                        </div>
                        <div>
                          <dt>Artifact format</dt>
                          <dd>
                            PDF · {record.pageCount}{" "}
                            {record.pageCount === 1 ? "page" : "pages"}
                          </dd>
                        </div>
                      </dl>

                      <div className="evidence-card__section">
                        <h4>What the public record documents</h4>
                        <p>{record.editorialSummary}</p>
                      </div>

                      <div className="evidence-card__section">
                        <h4>Independent mapping note</h4>
                        <ul className="evidence-mapping-list">
                          {record.directiveLinks.map((directiveLink) => {
                            const directive = directiveById(directiveLink.directiveId);
                            return (
                              <li key={directiveLink.directiveId}>
                                {directive ? (
                                  <Link href={`/directives/${directive.id}`}>
                                    Directive {directive.label}: {directive.title}
                                  </Link>
                                ) : (
                                  directiveLink.directiveId
                                )}
                                <span>
                                  Explicit citation: “{directiveLink.excerpt}” · pages{" "}
                                  {directiveLink.locator.pages.join("–")}
                                </span>
                                <span>{directiveLink.locator.locations.join("; ")}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      <div className="evidence-card__section evidence-card__limitations">
                        <h4>Limitations</h4>
                        <ul>
                          {record.limitations.map((limitation) => (
                            <li key={limitation}>{limitation}</li>
                          ))}
                        </ul>
                      </div>

                      <p className="evidence-card__accessibility">
                        <strong>Artifact accessibility note:</strong>{" "}
                        {record.accessibility.note}
                      </p>

                      <div className="evidence-card__links">
                        <a href={record.url} rel="noreferrer">
                          Open public record: {record.title}{" "}
                          <span aria-hidden="true">↗</span>
                        </a>
                        <a href={record.contextUrl} rel="noreferrer">
                          Open publishing context <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </section>

            <section id="meaning">
              <p className="section-code">Evidence 03</p>
              <h2>What a link does—and does not—mean</h2>
              <p>
                A link records a reviewed relationship between a public artifact
                and a signed directive. It does not establish implementation
                status, completion, compliance, success, or agency performance.
                It also makes no claim about work or records outside this curated
                collection.
              </p>
              <p>
                When no reviewed public artifacts are included for a directive,
                it means only that the current Atlas release contains no reviewed
                link for that directive. It is not evidence that no implementation
                activity or public record exists.
              </p>
              <p>
                <Link href="/methodology">Read the full methodology</Link>
              </p>
            </section>

            <section id="corrections">
              <p className="section-code">Evidence 04</p>
              <h2>Corrections</h2>
              <p>
                An evidence correction should identify the artifact, public URL,
                linked directive, exact locator, current value, and proposed
                replacement. Evidence, source, and analytical changes are reviewed
                as separate concepts.
              </p>
              <p>
                <a href={CONTENT_CORRECTION_URL} rel="noreferrer">
                  Suggest an evidence correction{" "}
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
