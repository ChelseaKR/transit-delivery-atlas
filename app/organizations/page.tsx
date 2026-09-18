import Link from "next/link";
import { LayerLabel } from "@/components/LayerLabel";
import { PageStructuredData } from "@/components/PageStructuredData";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { organizationRecords, organizationTotals } from "@/lib/organizations";
import { pageMetadata } from "@/lib/routes";

export const metadata = pageMetadata("/organizations");

export default function OrganizationsIndexPage() {
  return (
    <>
      <PageStructuredData path="/organizations" />
      <SiteHeader />
      <main id="main-content" className="document-page" tabIndex={-1}>
        <header className="document-hero">
          <div className="document-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Executive Order N-7-26</p>
            <h1>Bodies and groups named in the order</h1>
            <p>
              Every body and role group in the registry has a record page listing
              each directive that names it, under the source-role label the
              signed text supports, with the section locator and reviewed
              excerpt behind it. A named body is not an assignment of an action
              inside a compound directive, and being named is not an account of
              anything anyone has done.
            </p>

            <dl className="relationship-manifest" aria-label="Registry totals">
              <div>
                <dt>Bodies and groups</dt>
                <dd>{organizationTotals.organizations}</dd>
              </div>
              <div>
                <dt>Explicit source-role links</dt>
                <dd>{organizationTotals.sourceRoleLinks}</dd>
              </div>
              <div>
                <dt>Named in no directive</dt>
                <dd>{organizationTotals.withoutSourceRoleLinks}</dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="section-shell" aria-labelledby="organizations-index-title">
          <LayerLabel type="source" />
          <h2 id="organizations-index-title">The registry, alphabetically</h2>
          <p className="layer-intro">
            Ordered by name and by nothing else. An order by appearance count
            would read as a ranking of importance, effort, or responsibility,
            and this list ranks nothing.
          </p>
          <ul className="organization-index">
            {organizationRecords.map((record) => (
              <li key={record.id}>
                <Link href={`/organizations/${record.id}`}>{record.name}</Link>
                <p className="utility-label">{record.kindLabel}</p>
                <p>
                  {record.sourceRoleLinks === 0
                    ? "Named in no directive in the current release."
                    : `${record.sourceRoleLinks} source-role ${
                        record.sourceRoleLinks === 1 ? "link" : "links"
                      } across ${record.directiveCount} directive ${
                        record.directiveCount === 1 ? "unit" : "units"
                      }.`}
                </p>
              </li>
            ))}
          </ul>
          <p className="evidence-method-link">
            <Link href="/methodology">
              Read how the Atlas separates source, evidence, and analysis
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
