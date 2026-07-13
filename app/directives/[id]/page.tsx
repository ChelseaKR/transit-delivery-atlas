import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LayerLabel } from "@/components/LayerLabel";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { directiveById, directives, source } from "@/lib/data";
import { formatDate } from "@/lib/format";

interface PageProps {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return directives.map(({ id }) => ({ id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const directive = directiveById(id);
  if (!directive) return {};
  return {
    title: `${directive.label} ${directive.title}`,
    description: `Source-linked record for Executive Order N-7-26, section ${directive.locator.section}, with named entities, timing, public-evidence coverage, and separately labeled independent analysis.`,
    alternates: { canonical: `/directives/${directive.id}` },
  };
}

export default async function DirectivePage({ params }: PageProps) {
  const { id } = await params;
  const directive = directiveById(id);
  if (!directive) notFound();

  const index = directives.findIndex((item) => item.id === directive.id);
  const previous = directives[index - 1];
  const next = directives[index + 1];
  const pageFragment = directive.locator.pages[0];

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="directive-page" tabIndex={-1}>
        <header className="directive-hero">
          <div className="directive-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="directive-kicker">
              <span>{directive.label}</span>
              <span>Directive {directive.order} of {directives.length}</span>
            </p>
            <p className="utility-label">Editorial record title</p>
            <h1>{directive.title}</h1>
          </div>
        </header>

        <div className="directive-shell">
          <section className="record-layer record-layer--source" aria-labelledby="source-layer-title">
            <LayerLabel type="source" />
            <h2 id="source-layer-title">What the signed order says</h2>
            <blockquote>“{directive.excerpt}”</blockquote>
            <p className="excerpt-note">
              Short independently reviewed excerpt. The signed source image is authoritative.
            </p>

            {directive.sourceContexts.map((context) => (
              <div className="record-subsection" key={context.id}>
                <h3>Section context inherited from the signed order</h3>
                <blockquote>“{context.excerpt}”</blockquote>
                <p className="excerpt-note">
                  Source locator: {context.locator.section}, page {context.locator.pages.join("–")}.
                </p>
              </div>
            ))}

            <dl className="record-grid">
              <div>
                <dt>Locator</dt>
                <dd>
                  Section {directive.locator.section}; {directive.locator.pages.length > 1 ? "pages" : "page"}{" "}
                  {directive.locator.pages.join("–")}
                </dd>
              </div>
              <div>
                <dt>Explicit lead</dt>
                <dd>{directive.leadOrganizations.map((item) => item.name).join(", ")}</dd>
              </div>
              {directive.collaboratorOrganizations.length > 0 ? (
                <div>
                  <dt>Explicit collaborators</dt>
                  <dd>{directive.collaboratorOrganizations.map((item) => item.name).join(", ")}</dd>
                </div>
              ) : null}
              {directive.mentionedOrganizations.length > 0 ? (
                <div>
                  <dt>Other named parties</dt>
                  <dd>{directive.mentionedOrganizations.map((item) => item.name).join(", ")}</dd>
                </div>
              ) : null}
              <div>
                <dt>Source review</dt>
                <dd>{formatDate(directive.lastReviewedOn)}</dd>
              </div>
            </dl>

            {directive.qualifiers.length > 0 ? (
              <div className="record-subsection">
                <h3>Qualifiers preserved from the source</h3>
                <ul>
                  {directive.qualifiers.map((qualifier) => (
                    <li key={`${qualifier.text}-${qualifier.appliesTo}`}>
                      <strong>{qualifier.text}</strong> · applies to {qualifier.appliesTo}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {directive.sourceNotes.length > 0 ? (
              <div className="record-subsection">
                <h3>Source transcription notes</h3>
                <ul>
                  {directive.sourceNotes.map((note) => (
                    <li key={`${note.type}-${note.text}`}>
                      <strong>{note.type === "transcription" ? "Transcription note" : "Source note"}:</strong>{" "}
                      {note.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="record-subsection">
              <h3>Timing in the signed order</h3>
              {directive.timing.length > 0 ? (
                <ul className="timing-list">
                  {directive.timing.map((item) => (
                    <li key={`${item.sourceText}-${item.appliesTo}`}>
                      <strong>{formatDate(item.derivedDate)}</strong>
                      <span>{item.sourceText}</span>
                      <small>
                        Calculated planning date · applies to {item.appliesTo} · {item.derivation}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No explicit completion deadline is stated for this directive in the signed order.</p>
              )}
            </div>

            <a className="source-button" href={`${source.url}#page=${pageFragment}`} rel="noreferrer">
              Verify in signed PDF, page {pageFragment} (scanned, untagged) <span aria-hidden="true">↗</span>
            </a>
          </section>

          <section className="record-layer record-layer--evidence" aria-labelledby="evidence-layer-title">
            <LayerLabel type="evidence" />
            <h2 id="evidence-layer-title">What is documented publicly</h2>
            <p className="layer-intro">
              When included, the records below are dated public artifacts linked
              to this directive. Inclusion documents a source relationship; it does not establish
              implementation status, completion, compliance, or activity beyond
              the cited record.
            </p>

            {directive.evidence.length > 0 ? (
              <ul className="evidence-list">
                {directive.evidence.map((record) => {
                  const directiveLink = record.directiveLinks.find(
                    (link) => link.directiveId === directive.id,
                  );
                  if (!directiveLink) return null;

                  return (
                    <li key={record.id}>
                      <article
                        className="evidence-card"
                        aria-labelledby={`evidence-${record.id}-title`}
                      >
                        <p className="utility-label">Reviewed public artifact</p>
                        <h3 id={`evidence-${record.id}-title`}>{record.title}</h3>

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
                            <dt>Source locator</dt>
                            <dd>
                              Pages {directiveLink.locator.pages.join("–")}
                              <span>{directiveLink.locator.locations.join("; ")}</span>
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
                          <p>
                            The artifact explicitly cites this directive: “{directiveLink.excerpt}”
                          </p>
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
                  );
                })}
              </ul>
            ) : (
              <div className="evidence-empty">
                <p>
                  No reviewed public artifacts are included for this directive in
                  the current Atlas release. This is a statement about Atlas
                  coverage, not evidence that no implementation activity or public
                  record exists.
                </p>
              </div>
            )}

            <p className="evidence-method-link">
              <Link href="/evidence">Read the evidence scope and review method</Link>
            </p>
          </section>

          <section className="record-layer record-layer--analysis" aria-labelledby="analysis-layer-title">
            <LayerLabel type="analysis" />
            <h2 id="analysis-layer-title">Analytical crosswalk</h2>
            <p className="layer-intro">
              The items below are interpretation, not official assignments or implementation status.
            </p>

            <div className="record-subsection">
              <h3>Interpretive summary</h3>
              <p>{directive.analysis.summary}</p>
              <ul className="tag-list" aria-label="Analytical themes">
                {directive.themes.map((theme) => (
                  <li key={theme.id}>{theme.name}</li>
                ))}
              </ul>
            </div>

            <div className="record-subsection">
              <h3>Expected outputs</h3>
              <ul className="analysis-list">
                {directive.analysis.expectedOutputs.map((output) => (
                  <li key={output.text}>
                    <span>{output.text}</span>
                    <small>Inference · {output.confidence} confidence</small>
                  </li>
                ))}
              </ul>
            </div>

            <div className="record-subsection">
              <h3>Delivery dependencies</h3>
              <ul className="analysis-list">
                {directive.analysis.dependencies.map((dependency) => (
                  <li key={dependency.text}>
                    <span>{dependency.text}</span>
                    <small>Inference · {dependency.confidence} confidence</small>
                    {dependency.relatedDirectiveIds.length > 0 ? (
                      <span className="related-links">
                        Related:{" "}
                        {dependency.relatedDirectiveIds.map((relatedId, relatedIndex) => {
                          const related = directiveById(relatedId);
                          return related ? (
                            <span key={relatedId}>
                              {relatedIndex > 0 ? ", " : null}
                              <Link href={`/directives/${related.id}`}>{related.label}</Link>
                            </span>
                          ) : null;
                        })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="record-subsection open-questions">
              <h3>Open implementation questions</h3>
              <ol>
                {directive.analysis.openQuestions.map((question, questionIndex) => (
                  <li key={question}>
                    <span className="question-number">Q{questionIndex + 1}</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <nav className="directive-pagination" aria-label="Directive pages">
            {previous ? (
              <Link href={`/directives/${previous.id}`}>
                <span>Previous · {previous.label}</span>
                <strong>{previous.title}</strong>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={`/directives/${next.id}`}>
                <span>Next · {next.label}</span>
                <strong>{next.title}</strong>
              </Link>
            ) : <span />}
          </nav>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
