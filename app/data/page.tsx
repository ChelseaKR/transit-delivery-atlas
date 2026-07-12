import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Open data",
  description:
    "Download the Transit Delivery Atlas directive crosswalk as JSON or CSV and review its schema.",
  alternates: { canonical: "/data" },
};

const fields = [
  ["id", "Stable analytical identifier; not an official identifier"],
  ["label", "Signed section or subsection label"],
  ["locator", "Signed section and source PDF page"],
  ["excerpt", "Short independently reviewed transcription"],
  ["leadOrgIds", "Organizations explicitly directed as leads"],
  ["timing", "Source phrase, transparent calculation, and what it applies to"],
  ["analysis", "Separately stored summary, themes, outputs, dependencies, and questions"],
  ["lastReviewedOn", "Date the source record was last manually checked"],
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
              records and separately stored analytical records.
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
                  <strong>Complete public dataset</strong>
                  <small>Nested source, entity, timing, and analytical records</small>
                </a>
                <a className="download-card" href="/data/directives.csv" download>
                  <span className="file-type">CSV</span>
                  <strong>Flattened directive table</strong>
                  <small>One row per signed directive unit</small>
                </a>
                <a className="download-card" href="/data/schema.json">
                  <span className="file-type">SCHEMA</span>
                  <strong>JSON Schema</strong>
                  <small>Public export contract for version 0.1.0</small>
                </a>
              </div>
            </section>

            <section>
              <h2>Selected JSON fields</h2>
              <p>
                The JSON export uses nested camelCase fields. The CSV export
                uses flattened snake_case columns and prefixes analytical
                columns with <code>analysis_</code>. The downloadable JSON
                Schema is the exhaustive contract for the JSON dataset.
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
                Corrections should identify the directive ID, official source,
                exact locator, and proposed replacement. A source correction and
                an analytical change are reviewed as separate concepts.
              </p>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
