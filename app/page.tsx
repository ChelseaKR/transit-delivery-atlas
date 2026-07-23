import type { Metadata } from "next";
import { DirectiveExplorer } from "@/components/DirectiveExplorer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  directives,
  evidenceRecords,
  evidenceScope,
  leadOrganizations,
  source,
  themes,
} from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  const explorerDirectives = directives.map((directive) => ({
    id: directive.id,
    label: directive.label,
    title: directive.title,
    excerpt: directive.excerpt,
    leadOrgIds: [...directive.leadOrgIds],
    leadOrganizations: directive.leadOrganizations,
    collaboratorOrganizations: directive.collaboratorOrganizations,
    mentionedOrganizations: directive.mentionedOrganizations,
    timing: directive.timing.map(({ sourceText, derivedDate, appliesTo }) => ({
      sourceText,
      derivedDate,
      appliesTo,
    })),
    analysis: {
      summary: directive.analysis.summary,
      themeIds: [...directive.analysis.themeIds],
    },
    themes: directive.themes,
    evidenceCount: directive.evidence.length,
  }));

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="atlas-intro" aria-labelledby="atlas-title">
          <div className="section-shell">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <div className="atlas-intro__grid">
              <div className="atlas-intro__copy">
                <p className="utility-label">California Executive Order N-7-26</p>
                <h1 id="atlas-title">Transit Delivery Atlas</h1>
                <p>
                  A source-linked register of the order’s 21 directive units:
                  what the signed text says, which entities it names, what
                  timing is explicit, and what public evidence has been
                  reviewed.
                </p>
              </div>
              <dl className="atlas-manifest" aria-label="Atlas record totals">
                <div>
                  <dt>Directive records</dt>
                  <dd>{directives.length}</dd>
                </div>
                <div>
                  <dt>Evidence records</dt>
                  <dd>{evidenceRecords.length}</dd>
                </div>
                <div>
                  <dt>Evidence reviewed through</dt>
                  <dd>{formatDate(evidenceScope.lastUpdatedOn)}</dd>
                </div>
              </dl>
            </div>
            <aside className="source-strip" aria-label="Controlling source">
              <strong>Controlling source</strong>
              <span>Signed Executive Order N-7-26</span>
              <span>Effective {formatDate(source.effectiveOn)}</span>
              <span>Reviewed {formatDate(source.retrievedOn)}</span>
              <a href={source.url} rel="noreferrer">
                Open scanned PDF <span aria-hidden="true">↗</span>
              </a>
            </aside>
          </div>
        </section>

        <section id="directives" className="register-section" aria-labelledby="directives-title">
          <div className="section-shell">
            <div className="register-heading">
              <div>
                <p className="utility-label">Signed structure</p>
                <h2 id="directives-title">Directive register</h2>
                <p>
                  Filter the order in document sequence. Each record preserves
                  source, evidence, and analysis as separate layers.
                </p>
              </div>
              <div className="provenance-key" aria-label="Record layer key">
                <span><b>S</b> Source</span>
                <span><b>E</b> Evidence</span>
                <span><b>A</b> Analysis</span>
              </div>
            </div>
            <DirectiveExplorer
              directives={explorerDirectives}
              themes={themes}
              leadOrganizations={leadOrganizations}
            />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
