import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { orderMetadata, source } from "@/lib/data";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Transit Delivery Atlas separates signed source language, reviewed public evidence, date calculations, and independent analysis.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="document-page" tabIndex={-1}>
        <header className="document-hero">
          <div className="document-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Methodology</p>
            <h1>Keep source, evidence, and interpretation apart.</h1>
            <p>
              The atlas is useful only if a reader can tell what the signed order
              says, what a dated public artifact documents, what was calculated,
              and what remains analytical judgment.
            </p>
          </div>
        </header>

        <div className="document-shell">
          <nav className="page-index" aria-label="On this page">
            <p className="utility-label">On this page</p>
            <a href="#source">Source hierarchy</a>
            <a href="#units">Directive units</a>
            <a href="#layers">Three data layers</a>
            <a href="#timing">Timing calculations</a>
            <a href="#review">Review and corrections</a>
            <a href="#limits">Limitations</a>
          </nav>

          <article className="prose">
            <section id="source">
              <p className="section-code">Method 01</p>
              <h2>Source hierarchy</h2>
              <p>
                The signed Executive Order N-7-26 is the controlling source. The
                official announcement adds context but never overrides the signed
                text. The source registry records issuer, dates, retrieval date,
                URL, and SHA-256.
              </p>
              <p>
                <a href={source.url} rel="noreferrer">
                  Open the controlling signed source (scanned, untagged PDF) <span aria-hidden="true">↗</span>
                </a>
              </p>
            </section>

            <section id="units">
              <p className="section-code">Method 02</p>
              <h2>Twenty-one signed units</h2>
              <p>
                The atlas treats each labeled subsection as one unit: 1(a)–1(g),
                Section 2, 3(a)–3(j), and Sections 4–6. Sections 5 and 6 contain
                compound outputs, but remain single units because the source does
                not label separate subsections.
              </p>
              <p>
                The unnumbered filing and publicity clause is preserved as order
                metadata rather than invented as a twenty-second directive.
              </p>
              <p>
                The page-five non-enforceability clause is also preserved as
                order-level legal context: “{orderMetadata.sourceNotices[0].excerpt}”
              </p>
            </section>

            <section id="layers">
              <p className="section-code">Method 03</p>
              <h2>Three structural layers</h2>
              <div className="method-layers">
                <div className="method-layer method-layer--source">
                  <h3>Source record</h3>
                  <p>
                    Section and page locator, short reviewed excerpt, explicitly
                    named entities, qualifiers, timing language, and review date.
                  </p>
                </div>
                <div className="method-layer method-layer--evidence">
                  <h3>Reviewed public evidence</h3>
                  <p>
                    Dated public artifacts, publisher and retrieval provenance,
                    explicit directive relationships, review dates, locators,
                    accessibility notes, and limitations.
                  </p>
                </div>
                <div className="method-layer method-layer--analysis">
                  <h3>Independent analysis</h3>
                  <p>
                    Plain-language summary, controlled themes, inferred outputs,
                    dependencies, confidence labels, and open questions.
                  </p>
                </div>
              </div>
              <p>
                Evidence never changes what the order says, and an inference is
                never promoted to the source or evidence layer because it appears
                likely. There is no mutable implementation-status field.
              </p>
              <p>
                The evidence collection is selective rather than comprehensive or
                live. Inclusion documents a reviewed source relationship; it does
                not establish completion, compliance, success, or agency
                performance. An empty evidence list describes Atlas coverage—not
                the absence of activity or public records.
              </p>
            </section>

            <section id="timing">
              <p className="section-code">Method 04</p>
              <h2>Timing calculations</h2>
              <p>
                Section 1 begins with “Within 120 days of this Order.” The atlas
                applies that phrase to 1(a)–1(g) and calculates October 24, 2026 as
                120 calendar days after the June 26 effective date.
              </p>
              <p>
                Section 1(e) adds “within one year” for completed materials. The
                displayed June 26, 2027 date is the calendar-year anniversary.
                Both are labeled planning calculations rather than legal
                conclusions.
              </p>
              <p>
                Sections 2–6 receive no inferred completion date. In Section 2,
                “real time” describes dashboard behavior—not a delivery deadline.
              </p>
            </section>

            <section id="review">
              <p className="section-code">Method 05</p>
              <h2>Review and corrections</h2>
              <ol>
                <li>Extract and transcribe a short directive anchor.</li>
                <li>Verify section, page, organizations, qualifiers, and timing.</li>
                <li>Review the separate analytical record.</li>
                <li>
                  Review each public artifact’s provenance, date kind, directive
                  link, locator, and limitations separately.
                </li>
                <li>Run data, reference, timing, export, and rendered-page checks.</li>
                <li>Record source, evidence, and analytical corrections separately.</li>
              </ol>
            </section>

            <section id="limits">
              <p className="section-code">Method 06</p>
              <h2>Known limitations</h2>
              <ul>
                <li>The source is a scanned, untagged PDF.</li>
                <li>Short excerpts are independent transcriptions; the signed image controls.</li>
                <li>The atlas does not assess implementation progress or unpublished work.</li>
                <li>The public-evidence collection is selective and date-bounded.</li>
                <li>Calculated dates are planning aids rather than legal interpretation.</li>
                <li>Dependencies identify research questions, not official assignments.</li>
              </ul>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
