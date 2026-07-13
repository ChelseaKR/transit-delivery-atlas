import type { Metadata } from "next";
import { DirectiveExplorer } from "@/components/DirectiveExplorer";
import { HandoffRail } from "@/components/HandoffRail";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  directives,
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
  }));

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="hero">
          <div className="hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <div className="hero__grid">
              <div className="hero__copy">
                <p className="utility-label">Executive Order N-7-26</p>
                <h1>
                  California’s transit directives,
                  <span> mapped for delivery.</span>
                </h1>
                <p className="hero__dek">
                  A source-linked crosswalk of what the signed order directs,
                  which entities it names, when timing is explicit, which dated
                  public artifacts have been reviewed, and which delivery
                  questions remain open.
                </p>
                <div className="hero__actions">
                  <a className="button" href="#directives">
                    Explore directives
                  </a>
                  <a className="button button--secondary" href="/handoffs">
                    Explore delivery relationships
                  </a>
                  <a className="button button--secondary" href="/evidence">
                    Review public evidence
                  </a>
                </div>
              </div>
              <aside className="source-note" aria-label="Source review">
                <p className="utility-label">Controlling source</p>
                <h2>Signed order</h2>
                <dl>
                  <div>
                    <dt>Effective</dt>
                    <dd>{formatDate(source.effectiveOn)}</dd>
                  </div>
                  <div>
                    <dt>Last reviewed</dt>
                    <dd>{formatDate(source.retrievedOn)}</dd>
                  </div>
                  <div>
                    <dt>Source units</dt>
                    <dd>{directives.length}</dd>
                  </div>
                </dl>
                <a href={source.url} rel="noreferrer">
                  Open signed source (scanned, untagged PDF) <span aria-hidden="true">↗</span>
                </a>
              </aside>
            </div>
            <HandoffRail />
          </div>
        </section>

        <section className="deadline-section" aria-labelledby="deadline-title">
          <div className="section-shell">
            <div className="section-intro">
              <p className="utility-label">The order’s explicit clocks</p>
              <h2 id="deadline-title">Two planning dates. Carefully labeled.</h2>
              <p>
                The dates below are calendar calculations for navigation—not
                legal conclusions or implementation-status claims.
              </p>
            </div>
            <ol className="deadline-rail">
              <li>
                <time dateTime="2026-06-26">Jun 26, 2026</time>
                <strong>Order effective</strong>
                <span>Starting point printed in the signed order</span>
              </li>
              <li>
                <time dateTime="2026-10-24">Oct 24, 2026</time>
                <strong>Section 1 planning date</strong>
                <span>Calculated 120 calendar days after effectiveness</span>
              </li>
              <li>
                <time dateTime="2027-06-26">Jun 26, 2027</time>
                <strong>Section 1(e) planning date</strong>
                <span>Calculated one-year anniversary for completed materials</span>
              </li>
            </ol>
          </div>
        </section>

        <section className="boundary-section" aria-labelledby="boundary-title">
          <div className="section-shell boundary-grid">
            <div>
              <p className="utility-label">A deliberate boundary</p>
              <h2 id="boundary-title">This is not a progress dashboard.</h2>
            </div>
            <p>
              The atlas maps requirements, reviewed public artifacts, and
              analytical dependencies. Evidence links document only what the
              cited records show; they do not establish that work has started,
              stopped, succeeded, failed, or occurred outside the public record.
              Sections 2–6 are shown as having no explicit completion deadline
              in the signed order—not as having no deadline anywhere else. The
              order’s separate non-enforceability clause is also preserved in
              the source model and methodology.
            </p>
          </div>
        </section>

        <section id="directives" className="directives-section" aria-labelledby="directives-title">
          <div className="section-shell">
            <div className="section-intro section-intro--wide">
              <p className="utility-label">Signed structure + public evidence + analysis</p>
              <h2 id="directives-title">Twenty-one directive units</h2>
              <p>
                Filter the signed document structure. Every detail page shows
                source language first, reviewed public evidence second, and
                independent analysis third.
              </p>
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
