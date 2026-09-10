import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CONTENT_CORRECTION_URL } from "@/lib/feedback";

export const metadata: Metadata = {
  title: "Open data",
  description:
    "Download the Transit Delivery Atlas directive, relationship, public-evidence, and context-watchlist datasets and review their public schemas.",
  alternates: { canonical: "/data" },
};

const fields = [
  ["id", "Stable analytical identifier; not an official identifier"],
  ["label", "Signed section or subsection label"],
  ["locator", "Signed section and source PDF page"],
  ["excerpt", "Short independently reviewed transcription"],
  ["leadOrgIds", "Organizations explicitly directed as leads"],
  ["collaboratorOrgIds", "Organizations explicitly named as collaborators"],
  ["mentionedOrgIds", "Other bodies or role groups explicitly named in the directive"],
  ["timing", "Source phrase, transparent calculation, and what it applies to"],
  ["analysis", "Separately stored summary, themes, outputs, dependencies, and questions"],
  ["evidenceScope", "Selective-coverage statement for the reviewed public-artifact layer"],
  ["evidence", "Dated public artifacts with provenance, directive links, locators, review dates, and limitations"],
  ["directiveLinks", "Explicit artifact-to-directive relationships with excerpts and page locators"],
  ["watchlist.scope", "Selective-context scope for the separate, non-evidentiary research watchlist"],
  ["watchlist.items", "Official context sources and publication checkpoints with editorial relevance links and evidence-boundary notes"],
  ["watchlist.nextReviewOn", "Planned date for checking whether a more informative or qualifying public artifact has appeared"],
  ["dataReviewedThrough", "Latest manual review date across the exported directive and evidence records"],
  ["lastReviewedOn", "Date a source or evidence record was last manually checked"],
];

export default function DataPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="document-page" tabIndex={-1}>
        <header className="document-hero document-hero--data">
          <div className="document-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Open data</p>
            <h1>Inspect, reuse, and challenge the crosswalk.</h1>
            <p>
              The interface and downloads are generated from the same 21 source
              records, separately stored analytical records, and selective
              public-evidence collection. A separate context-watchlist contract
              carries non-evidentiary research leads. Normalized relationship
              tables and all public downloads are derived during the same
              deterministic build.
            </p>
          </div>
        </header>

        <div className="document-shell document-shell--single">
          <article className="prose prose--wide">
            <section>
              <h2>Downloads</h2>
              <div className="download-grid">
                <a className="download-card" href="/data/directives.json" download>
                  <span className="file-type">JSON</span>
                  <strong>Structured public dataset</strong>
                  <small>Nested source, entity, timing, evidence, and analytical records</small>
                </a>
                <a className="download-card" href="/data/directives.csv" download>
                  <span className="file-type">CSV</span>
                  <strong>Flattened directive table</strong>
                  <small>One row per signed directive unit</small>
                </a>
                <a className="download-card" href="/data/evidence.csv" download>
                  <span className="file-type">EVIDENCE CSV</span>
                  <strong>Flattened evidence table</strong>
                  <small>One row per reviewed public artifact</small>
                </a>
                <a className="download-card" href="/data/watchlist.json" download>
                  <span className="file-type">WATCHLIST JSON</span>
                  <strong>Context watchlist</strong>
                  <small>Official research leads kept outside implementation evidence</small>
                </a>
                <a className="download-card" href="/data/watchlist.csv" download>
                  <span className="file-type">WATCHLIST CSV</span>
                  <strong>Flattened watchlist table</strong>
                  <small>One row per context source or publication checkpoint</small>
                </a>
                <a className="download-card" href="/data/watchlist-schema.json">
                  <span className="file-type">WATCHLIST SCHEMA</span>
                  <strong>Watchlist JSON Schema</strong>
                  <small>Independent contract for context-only research records</small>
                </a>
                <a className="download-card" href="/data/organizations.csv" download>
                  <span className="file-type">REGISTRY CSV</span>
                  <strong>Bodies and role groups</strong>
                  <small>One row per registered body, named by the order or not</small>
                </a>
                <a className="download-card" href="/data/directive-organizations.csv" download>
                  <span className="file-type">SOURCE LINKS CSV</span>
                  <strong>Directive-to-body relationships</strong>
                  <small>One row per explicit lead, collaborator, or other named party</small>
                </a>
                <a className="download-card" href="/data/directive-relationships.csv" download>
                  <span className="file-type">ANALYSIS LINKS CSV</span>
                  <strong>Directive cross-references</strong>
                  <small>One row per related-directive ID in an inferred dependency statement</small>
                </a>
                <a className="download-card" href="/data/schema.json">
                  <span className="file-type">SCHEMA</span>
                  <strong>JSON Schema</strong>
                  <small>Public export contract for version 0.3.0</small>
                </a>
                <a
                  className="download-card"
                  href="/data/tda-ntd-feasibility.json"
                  download
                >
                  <span className="file-type">RESEARCH</span>
                  <strong>TDA/NTD four-field slice</strong>
                  <small>Definitions, feasibility classes, controls, and evidence gaps</small>
                </a>
                <a className="download-card" href="/data/datapackage.json">
                  <span className="file-type">DATA PACKAGE</span>
                  <strong>Frictionless Data Package</strong>
                  <small>Typed Table Schemas, licence split, and source provenance for every file here</small>
                </a>
                <a className="download-card" href="/data/dcat.jsonld">
                  <span className="file-type">DCAT</span>
                  <strong>DCAT-AP catalog record</strong>
                  <small>JSON-LD dataset description for catalog harvesters</small>
                </a>
                <a className="download-card" href="/changes.json">
                  <span className="file-type">CHANGE LOG</span>
                  <strong>Record-level change log</strong>
                  <small>Every dated event this build can derive, one entry per record</small>
                </a>
                <a className="download-card" href="/changes.xml">
                  <span className="file-type">ATOM</span>
                  <strong>Change feed</strong>
                  <small>The same entries as Atom 1.0, plus one feed per directive</small>
                </a>
              </div>
            </section>

            <section>
              <h2>Following the record without polling it</h2>
              <p>
                <a href="/changes.xml">
                  <code>changes.xml</code>
                </a>{" "}
                is an Atom 1.0 feed of dated, record-level events: a review
                sweep recorded, an evidence record added or re-reviewed, a cited
                artifact retrieved again, a context-watchlist item re-reviewed
                or narrowed, a calculated planning date reached, and a planned
                review date that this build found had passed. Each directive has
                its own filtered feed at{" "}
                <code>/directives/&lt;id&gt;/changes.xml</code>, so a reader
                following one directive is not sent everything.
              </p>
              <p>
                There is nothing to sign up for and nothing that identifies you:
                the feed is a static file served from this origin, like every
                other file on this page. The same entries are also published as{" "}
                <a href="/changes.json">
                  <code>changes.json</code>
                </a>
                , which carries the layer, the record id, and the path each entry
                resolves to.
              </p>
              <p>
                An entry records what this project did, never what a named body
                did. Every entry carries an <code>observedBy</code> field:{" "}
                <code>data</code> means the entry&rsquo;s date is one the
                committed data holds, so rebuilding the site does not move it;{" "}
                <code>build</code> means the date is this build&rsquo;s own
                observation of an absence, which is how a lapsed review date is
                recorded, because the lapse is the missing record and a missing
                record carries no date of its own.
              </p>
            </section>

            <section>
              <h2>Loading these files without reading this page</h2>
              <p>
                <a href="/data/datapackage.json">
                  <code>datapackage.json</code>
                </a>{" "}
                is a{" "}
                <a href="https://datapackage.org/">Frictionless Data Package</a>{" "}
                describing every file above: a Table Schema per CSV giving each
                column its name, type and whether it is ever empty, the
                separator a multi-valued cell uses, the licence split, and the
                signed source&rsquo;s retrieval date and SHA-256. It is
                generated at build from the same values the CSVs are written
                from and compared byte for byte against the committed copy, so a
                column that changes shape changes its schema in the same commit.
                Tools such as <code>frictionless</code> and{" "}
                <code>pandas</code> can read it directly.
              </p>
              <p>
                <a href="/data/dcat.jsonld">
                  <code>dcat.jsonld</code>
                </a>{" "}
                is the same dataset as a DCAT-AP record for catalog harvesters.
                Both files date the data by its review dates, never by the
                moment of the build; the commit a build came from is published
                separately at <code>/version.json</code>.
              </p>
              <p>
                The{" "}
                <a href="https://github.com/ChelseaKR/transit-delivery-atlas/blob/main/docs/DATA-CARD.md">
                  data card
                </a>{" "}
                states the classification, provenance, update cadence, licence
                split and known limitations of the dataset as a whole.
              </p>
            </section>

            <section>
              <h2>Selected JSON fields</h2>
              <p>
                The JSON export uses nested camelCase fields. The CSV export
                uses flattened snake_case columns and prefixes analytical
                columns with <code>analysis_</code>. The downloadable JSON
                Schema is the exhaustive contract for the JSON dataset. Evidence
                is a separate top-level collection so a public artifact never
                silently changes the signed source or analytical record.
              </p>
              <p>
                The context watchlist is published under its own versioned JSON
                and schema. It is joined to directive pages through editorial
                relevance IDs, but it is not embedded in the directive/evidence
                contract and never contributes an evidence count.
              </p>
              <p>
                The normalized relationship CSVs flatten explicit source-role
                assignments and recorded cross-reference edges already present
                in that JSON contract. They are not replacements for the complete
                JSON: dependency statements without a related directive remain in
                the JSON and interface. In the analytical table,
                <code>record_directive_id</code> identifies the record carrying the
                statement; it does not assert workflow direction, sequence,
                ownership, or implementation status.
              </p>
              <p>
                Product and data-contract versions are tracked independently.
                Release 0.3 added this interface and normalized CSVs without
                changing the canonical JSON shape. Data-contract version 0.3.0
                adds the evidence layer&apos;s review commitment: a next review
                date, a committed list of public sources with last-checked dates,
                and a sweep log inside <code>evidenceScope</code>. The separate
                watchlist contract begins at version 0.1.0.
              </p>
              <div className="table-scroll" tabIndex={0} role="region" aria-label="Data dictionary table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map(([field, meaning]) => (
                      <tr key={field}>
                        <th scope="row"><code>{field}</code></th>
                        <td>{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2>Reuse and corrections</h2>
              <p>
                Original structured analysis and documentation are available
                under CC BY 4.0. Code is licensed under the Apache License 2.0.
                Government source material remains subject to its own terms and
                is not relicensed here.
              </p>
              <p>
                Corrections should identify the directive, evidence, or
                watchlist ID; public source; exact locator or boundary statement;
                and proposed replacement. Source, evidence, watchlist, and
                analytical changes are reviewed as separate concepts.
              </p>
              <p>
                <a href={CONTENT_CORRECTION_URL} rel="noreferrer">
                  Suggest a source-backed correction{" "}
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
