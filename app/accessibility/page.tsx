import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "Accessibility standards, test scope, and known limitations for Transit Delivery Atlas.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="document-page" tabIndex={-1}>
        <header className="document-hero document-hero--accessibility">
          <div className="document-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Accessibility</p>
            <h1>Accessibility is a release requirement.</h1>
            <p>
              The atlas targets WCAG 2.2 Level AA and is being evaluated against
              applicable Revised Section 508 web requirements.
            </p>
          </div>
        </header>

        <div className="document-shell document-shell--single">
          <article className="prose prose--wide">
            <section>
              <h2>Standards target</h2>
              <p>
                Revised Section 508 incorporates WCAG 2.0 Level A and AA for web
                content. WCAG 2.2 AA adds newer success criteria, but does not by
                itself prove full 508 conformance. Scoping, functional
                performance, support, and documentation still matter.
              </p>
              <p>
                This independent site is not represented as a federal system or
                as certified. Section 508 readiness is relevant because California
                Government Code §7405 applies Section 508 accessibility
                requirements to state governmental entities’ information
                technology work and procurement.
              </p>
            </section>

            <section>
              <h2>Current evaluation status</h2>
              <h3>Completed on the current development build</h3>
              <ul className="test-layers">
                <li><strong>Static:</strong> lint, canonical-data validation, and rendered HTML assertions.</li>
                <li><strong>Structure:</strong> checks for page language, titles, skip navigation, main regions, layer labels, and the result-count live region.</li>
                <li><strong>Automated review:</strong> representative-route scans plus programmatic reflow, focus-order, and reduced-motion spot checks.</li>
              </ul>
              <h3>Pending before any conformance claim</h3>
              <ul className="test-layers">
                <li><strong>Keyboard:</strong> complete user-flow review in current Chrome, Firefox, and Safari.</li>
                <li><strong>Assistive technology:</strong> VoiceOver and NVDA or JAWS review of the explorer, directive detail, method, and download flows.</li>
                <li><strong>Low vision:</strong> full 200% and 400% zoom, text-spacing, forced-colors, and narrow-width review across every route.</li>
                <li><strong>Human evaluation:</strong> testing with disabled users and a documented decision about the inaccessible external source PDF.</li>
              </ul>
              <p>
                Automated checks are quality controls, not certification. Until
                the pending reviews are complete and exceptions are documented,
                the project does not claim WCAG or Section 508 conformance. A
                future Accessibility Conformance Report would need to name the
                exact release, evaluator, method, environment, and exceptions.
              </p>
            </section>

            <section className="known-limit">
              <h2>Known external limitation</h2>
              <p>
                The signed executive order is hosted externally as a scanned,
                untagged PDF outside this repository and the site evaluation
                scope. The atlas provides semantic HTML summaries, short reviewed
                excerpts, and page locators to reduce that barrier, but those are
                not a complete alternative version and cannot remediate the
                authoritative source file.
              </p>
            </section>

            <section>
              <h2>References</h2>
              <ul>
                <li><a href="https://www.section508.gov/test/websites/">Section 508 web-content overview</a></li>
                <li><a href="https://ictbaseline.access-board.gov/web-baselines/">ICT Testing Baseline for the Web</a></li>
                <li><a href="https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=7405">California Government Code §7405</a></li>
              </ul>
            </section>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
