import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Open data",
  description:
    "Download the Transit Delivery Atlas directive, named-body, analytical-relationship, and public-evidence crosswalks and review the public schema.",
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
              public-evidence collection. Normalized relationship tables are
              derived during the same deterministic build.
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
                  <small>Public export contract for version 0.2.0</small>
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
              </div>
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
                Release 0.3 adds this interface and normalized CSVs without
                changing the canonical JSON shape, so that schema remains at
                version 0.2.0.
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
                under CC BY 4.0. Code is MIT licensed. Government source material
                remains subject to its own terms and is not relicensed here.
              </p>
              <p>
                Corrections should identify the directive or evidence ID, public
                source, exact locator, and proposed replacement. Source,
                evidence, and analytical changes are reviewed as separate
                concepts.
              </p>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
