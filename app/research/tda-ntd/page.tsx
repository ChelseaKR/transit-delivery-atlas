import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { tdaNtdFeasibility } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "TDA/NTD reporting feasibility",
  description:
    "A cited four-field comparison of California TDA and National Transit Database reporting, with an explicit automation boundary.",
  alternates: { canonical: "/research/tda-ntd" },
};

const sourceById = new Map(
  tdaNtdFeasibility.sources.map((source) => [source.id, source] as const),
);
const classificationById = new Map(
  tdaNtdFeasibility.classificationDefinitions.map(
    (classification) => [classification.id, classification] as const,
  ),
);

function requiredSource(id: string) {
  const source = sourceById.get(id);
  if (!source) throw new Error(`Missing research source: ${id}`);
  return source;
}

function requiredClassification(id: string) {
  const classification = classificationById.get(id);
  if (!classification) throw new Error(`Missing research classification: ${id}`);
  return classification;
}

export default function TdaNtdResearchPage() {
  const conditionalCount = tdaNtdFeasibility.fields.filter(
    ({ classification }) => classification === "conditionally-automatable",
  ).length;
  const assistedCount = tdaNtdFeasibility.fields.filter(
    ({ classification }) => classification === "assistable-human-method-review",
  ).length;
  const reconciliationCount = tdaNtdFeasibility.fields.filter(
    ({ classification }) => classification === "reconciliation-required",
  ).length;

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="document-page" tabIndex={-1}>
        <header className="document-hero document-hero--research">
          <div className="document-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Directive 3(b) research slice</p>
            <h1>Four fields. One honest automation boundary.</h1>
            <p>
              A source-linked comparison of California transit-operator reporting
              and the 2026 National Transit Database reduced-reporting rules.
            </p>
          </div>
        </header>

        <div className="document-shell document-shell--single">
          <article className="prose prose--wide">
            <section aria-labelledby="finding-title">
              <p className="utility-label">
                Evidence reviewed through {formatDate(tdaNtdFeasibility.reviewedOn)}
              </p>
              <h2 id="finding-title">Automate preparation, not accountability.</h2>
              <p className="research-lede">{tdaNtdFeasibility.conclusion}</p>

              <dl className="research-kpis" aria-label="Feasibility summary">
                <div>
                  <dt>Conditional calculations</dt>
                  <dd>{conditionalCount}</dd>
                </div>
                <div>
                  <dt>Method reviews</dt>
                  <dd>{assistedCount}</dd>
                </div>
                <div>
                  <dt>Reconciliations</dt>
                  <dd>{reconciliationCount}</dd>
                </div>
                <div>
                  <dt>Unattended filings supported</dt>
                  <dd>0</dd>
                </div>
              </dl>

              <div className="research-boundary">
                <h3>What the public evidence supports</h3>
                <p>
                  California law directs the State Controller’s uniform system to
                  include data required by the U.S. Department of Transportation.
                  That makes a shared source layer plausible. It does not erase the
                  two reports’ scope, validation, audit, and certification rules.
                  The State Controller requires a signed filing. Direct urban reduced
                  NTD reporters complete annual CEO certification, while Caltrans
                  supplies forms and files statewide on behalf of its rural Section
                  5311 subrecipients.
                </p>
                <p>
                  This slice compares published definitions only. It is not an
                  official interpretation, compliance determination, system design,
                  or finding about any agency’s current data readiness.
                </p>
              </div>

              <div className="research-paths" aria-labelledby="paths-title">
                <h3 id="paths-title">Do not collapse the two NTD reporting paths.</h3>
                <div>
                  {tdaNtdFeasibility.reportingPaths.map((path) => (
                    <article key={path.id}>
                      <h4>{path.label}</h4>
                      <p>{path.description}</p>
                      <p className="research-paths__sources">
                        {path.sourceIds.map((sourceId, index) => {
                          const source = requiredSource(sourceId);
                          return (
                            <span key={sourceId}>
                              {index > 0 ? " · " : null}
                              <a href={source.url} rel="noreferrer">
                                {source.publisher} <span aria-hidden="true">↗</span>
                              </a>
                            </span>
                          );
                        })}
                      </p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="research-actions">
                <Link className="button" href="/directives/n-7-26-3b">
                  Read directive 3(b)
                </Link>
                <a
                  className="button button--secondary"
                  href="/data/tda-ntd-feasibility.json"
                  download
                >
                  Download research JSON
                </a>
              </div>
            </section>

            <section aria-labelledby="crosswalk-title">
              <p className="utility-label">Field crosswalk</p>
              <h2 id="crosswalk-title">Where the definitions meet—and diverge.</h2>
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="TDA and NTD four-field feasibility table"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Measure</th>
                      <th scope="col">California TDA report</th>
                      <th scope="col">NTD reduced report</th>
                      <th scope="col">Assessment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tdaNtdFeasibility.fields.map((field) => {
                      const classification = requiredClassification(
                        field.classification,
                      );
                      return (
                        <tr key={field.id}>
                          <th scope="row">
                            <a href={`#${field.id}`}>{field.label}</a>
                          </th>
                          <td>
                            <strong>{field.tda.field}</strong>
                            <br />
                            <small>{field.tda.form}</small>
                          </td>
                          <td>
                            <strong>{field.ntd.field}</strong>
                            <br />
                            <small>{field.ntd.form}</small>
                          </td>
                          <td>
                            <span
                              className={`assessment-chip assessment-chip--${field.classification}`}
                            >
                              {classification.label}
                            </span>
                            <br />
                            <small>{field.confidence} confidence</small>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="field-findings-title">
              <p className="utility-label">Field findings</p>
              <h2 id="field-findings-title">A prototype boundary for each value.</h2>

              <div className="research-fields">
                {tdaNtdFeasibility.fields.map((field, index) => {
                  const classification = requiredClassification(
                    field.classification,
                  );
                  const tdaSource = requiredSource(field.tda.sourceId);
                  const ntdSource = requiredSource(field.ntd.sourceId);

                  return (
                    <section className="research-field" id={field.id} key={field.id}>
                      <p className="utility-label">Field {index + 1} of 4</p>
                      <div className="research-field__heading">
                        <h3>{field.label}</h3>
                        <span
                          className={`assessment-chip assessment-chip--${field.classification}`}
                        >
                          {classification.label}
                        </span>
                      </div>

                      <div className="method-layers">
                        <div className="method-layer">
                          <p className="utility-label">California TDA report</p>
                          <h4>{field.tda.field}</h4>
                          <p>{field.tda.definition}</p>
                          <p>
                            <a href={tdaSource.url} rel="noreferrer">
                              {tdaSource.publisher}, {field.tda.locator}{" "}
                              <span aria-hidden="true">↗</span>
                            </a>
                          </p>
                        </div>
                        <div className="method-layer method-layer--analysis">
                          <p className="utility-label">NTD reduced report</p>
                          <h4>{field.ntd.field}</h4>
                          <p>{field.ntd.definition}</p>
                          <p>
                            <a href={ntdSource.url} rel="noreferrer">
                              {ntdSource.publisher}, {field.ntd.locator}{" "}
                              <span aria-hidden="true">↗</span>
                            </a>
                          </p>
                        </div>
                      </div>

                      <h4>Finding</h4>
                      <p>{field.finding}</p>

                      <div className="research-control-grid">
                        <div>
                          <h4>Controls before reuse</h4>
                          <ul>
                            {field.requiredControls.map((control) => (
                              <li key={control}>{control}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4>Evidence still needed</h4>
                          <ul>
                            {field.remainingEvidence.map((evidence) => (
                              <li key={evidence}>{evidence}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="controls-title">
              <p className="utility-label">Implementation guardrails</p>
              <h2 id="controls-title">One source layer, two accountable reports.</h2>
              <ol className="research-control-list">
                {tdaNtdFeasibility.crossCuttingControls.map((control) => (
                  <li key={control}>{control}</li>
                ))}
              </ol>

              <div className="known-limit">
                <h3>Next evidence step</h3>
                <p>{tdaNtdFeasibility.nextEvidenceStep}</p>
              </div>
            </section>

            <section aria-labelledby="sources-title">
              <p className="utility-label">Primary sources</p>
              <h2 id="sources-title">Review the evidence directly.</h2>
              <ol className="research-source-list">
                {tdaNtdFeasibility.sources.map((source) => (
                  <li id={`source-${source.id}`} key={source.id}>
                    <a href={source.url} rel="noreferrer">
                      <strong>{source.title}</strong>{" "}
                      <span aria-hidden="true">↗</span>
                    </a>
                    <span>{source.publisher}</span>
                    <small>
                      Published {formatDate(source.publishedOn)} · reviewed {" "}
                      {formatDate(source.retrievedOn)}
                    </small>
                    <p>{source.scopeNote}</p>
                  </li>
                ))}
              </ol>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
