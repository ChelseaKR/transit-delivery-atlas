import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  CONTENT_CORRECTION_URL,
  REVIEW_FEEDBACK_URL,
  SECURITY_POLICY_URL,
} from "@/lib/feedback";

export const metadata: Metadata = {
  title: "Corrections and review",
  description:
    "Suggest a source-backed correction or share structured review feedback about Transit Delivery Atlas.",
  alternates: { canonical: "/corrections" },
};

export default function CorrectionsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="document-page" tabIndex={-1}>
        <header className="document-hero">
          <div className="document-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Corrections and review</p>
            <h1>Challenge the record, with a source.</h1>
            <p>
              Choose the path that matches what you found. Both forms create a
              public GitHub issue so the evidence, discussion, and resolution
              remain inspectable.
            </p>
          </div>
        </header>

        <div className="document-shell document-shell--single">
          <article className="prose prose--wide">
            <section aria-labelledby="choose-path-title">
              <p className="section-code">Correction 01</p>
              <h2 id="choose-path-title">Choose the kind of contribution.</h2>

              <div className="method-layers correction-paths">
                <div className="method-layer">
                  <p className="utility-label">Source-backed correction</p>
                  <h3>Correct content or data</h3>
                  <p>
                    Use this when a source transcription, public-evidence record,
                    analytical claim, relationship, research finding, or export
                    should change.
                  </p>
                  <ul>
                    <li>Identify the record or page.</li>
                    <li>Quote the current and proposed content.</li>
                    <li>Provide a public source and exact locator.</li>
                  </ul>
                  <p className="correction-path__action">
                    <a className="button" href={CONTENT_CORRECTION_URL}>
                      Suggest a correction <span aria-hidden="true">↗</span>
                    </a>
                  </p>
                </div>

                <div className="method-layer method-layer--analysis">
                  <p className="utility-label">Observed review finding</p>
                  <h3>Share review feedback</h3>
                  <p>
                    Use this when navigation, wording, accessibility, a research
                    boundary, or a data-reuse flow was unclear but you do not yet
                    have a complete correction packet.
                  </p>
                  <ul>
                    <li>Name the page and task.</li>
                    <li>Describe what happened without a general rating.</li>
                    <li>Propose the smallest change that would have helped.</li>
                  </ul>
                  <p className="correction-path__action">
                    <a
                      className="button button--secondary"
                      href={REVIEW_FEEDBACK_URL}
                    >
                      Share review feedback <span aria-hidden="true">↗</span>
                    </a>
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="before-title">
              <p className="section-code">Correction 02</p>
              <h2 id="before-title">Keep public issues safe and reviewable.</h2>
              <div className="known-limit">
                <h3>Before you submit</h3>
                <p>
                  Do not include private agency records, passenger-level data,
                  personal information, credentials, or security details. Use the{" "}
                  <a href={SECURITY_POLICY_URL}>repository security policy</a> for
                  a vulnerability report.
                </p>
              </div>
              <p>
                Source, evidence, and analytical changes remain separate even
                when one correction affects more than one layer. A submitted issue
                is a review request—not proof that the current Atlas is wrong or
                that the proposed replacement is accepted.
              </p>
            </section>

            <section aria-labelledby="process-title">
              <p className="section-code">Correction 03</p>
              <h2 id="process-title">What happens next.</h2>
              <ol>
                <li>The report is classified as source, evidence, analysis, relationship, research, or interface feedback.</li>
                <li>The cited public source and locator are checked against the current record.</li>
                <li>Accepted changes are tested, recorded in the changelog, and released through the normal review path.</li>
              </ol>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
