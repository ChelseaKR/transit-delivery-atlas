import type { Metadata } from "next";
import {
  DependencyExplorer,
  OrganizationExplorer,
} from "@/components/HandoffExplorer";
import { LayerLabel } from "@/components/LayerLabel";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { themes } from "@/lib/data";
import {
  dependencyRoutes,
  namedBodies,
  relationshipTotals,
} from "@/lib/relationships";

export const metadata: Metadata = {
  title: "Delivery relationships",
  description:
    "Explore bodies and groups explicitly named in California's transit executive order and separately labeled analytical relationships between its directive units.",
  alternates: { canonical: "/handoffs" },
};

export default function HandoffsPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="handoff-page" tabIndex={-1}>
        <header className="document-hero document-hero--handoffs">
          <div className="document-hero__inner handoff-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Potential handoff map</p>
            <h1>Trace the delivery relationships.</h1>
            <p>
              See which bodies and groups the signed order explicitly names,
              then inspect a separately labeled analytical layer of delivery
              dependencies and cross-directive references.
            </p>
            <div className="hero__actions handoff-hero__actions">
              <a className="button" href="#named-bodies">
                Explore named bodies
              </a>
              <a className="button button--secondary" href="#analytical-links">
                Explore analytical links
              </a>
            </div>

            <dl className="relationship-manifest" aria-label="Relationship dataset totals">
              <div>
                <dt>Bodies and groups</dt>
                <dd>{relationshipTotals.namedBodies}</dd>
              </div>
              <div>
                <dt>Explicit source-role links</dt>
                <dd>{relationshipTotals.sourceRoleLinks}</dd>
              </div>
              <div>
                <dt>Inferred dependency statements</dt>
                <dd>{relationshipTotals.dependencyStatements}</dd>
              </div>
              <div>
                <dt>Analytical cross-references</dt>
                <dd>{relationshipTotals.analyticalReferences}</dd>
              </div>
            </dl>

            <div className="transfer-seam" aria-hidden="true">
              <span className="transfer-seam__source" />
              <span className="transfer-seam__junction" />
              <span className="transfer-seam__analysis" />
            </div>
          </div>
        </header>

        <section className="boundary-section" aria-labelledby="handoff-boundary-title">
          <div className="section-shell boundary-grid">
            <div>
              <p className="utility-label">Read the seam, not a workflow</p>
              <h2 id="handoff-boundary-title">A relationship is not a status.</h2>
            </div>
            <p>
              Source-role links record how a body or group is named in the signed
              text. Analytical cross-references are independent interpretation. A
              connection does not establish sequence, ownership, responsibility,
              an official dependency, implementation activity, or performance.
              Reciprocal references show two analytical records pointing to each
              other—not work moving in both directions.
            </p>
          </div>
        </section>

        <section
          id="named-bodies"
          className="handoff-section handoff-section--source"
          aria-labelledby="named-bodies-title"
        >
          <div className="section-shell">
            <div className="section-intro section-intro--wide">
              <LayerLabel type="source" />
              <p className="utility-label">Relationship layer 01</p>
              <h2 id="named-bodies-title">Bodies and groups named in the order</h2>
              <p>
                Every card is derived from the directive-level source fields for
                explicit leads, explicit collaborators, and other named parties.
                The labels do not imply that every party participates in every
                action inside a compound directive.
              </p>
            </div>
            <OrganizationExplorer records={namedBodies} />
          </div>
        </section>

        <section
          id="analytical-links"
          className="handoff-section handoff-section--analysis"
          aria-labelledby="analytical-links-title"
        >
          <div className="section-shell">
            <div className="section-intro section-intro--wide">
              <LayerLabel type="analysis" />
              <p className="utility-label">Relationship layer 02</p>
              <h2 id="analytical-links-title">Inferred delivery dependencies</h2>
              <p>
                These cards preserve all dependency statements in the current
                analytical layer. A related directive ID is shown as a
                cross-reference, not an upstream or downstream arrow. Confidence
                labels describe the analyst&apos;s interpretation and do not rank
                importance, effort, or progress.
              </p>
            </div>
            <DependencyExplorer
              routes={dependencyRoutes}
              themes={themes}
              totalReferences={relationshipTotals.analyticalReferences}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
