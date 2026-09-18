import { PageStructuredData } from "@/components/PageStructuredData";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  GA4_DATA_RETENTION,
  OPT_OUT_STORAGE_KEY,
  analyticsEnabled,
} from "@/lib/analytics";
import { pageMetadata } from "@/lib/routes";

const enabled = analyticsEnabled();

export const metadata = pageMetadata("/privacy");

function Hosting() {
  return (
    <>
      <section>
        <h2>Hosting</h2>
        <p>
          The site is static files served by Amazon CloudFront from Amazon S3.
          CloudFront receives each request for a page, as any web host does.
          This project keeps no server log of readers and has no accounts, no
          sign-in and no forms.
        </p>
      </section>
    </>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <PageStructuredData path="/privacy" />
      <SiteHeader />
      <main id="main-content" className="document-page" tabIndex={-1}>
        <header className="document-hero">
          <div className="document-hero__inner">
            <p className="independence-badge">Independent analysis · Unofficial</p>
            <p className="utility-label">Privacy</p>
            <h1>What this site measures.</h1>
            <p>
              {enabled
                ? "Pages use Google Analytics 4 to count visits. Its advertising features are off, and it does not load at all if your browser asks not to be tracked."
                : "Nothing. This site runs no analytics, loads no script from anyone else, and sets no cookies."}
            </p>
          </div>
        </header>

        <div className="document-shell document-shell--single">
          <article className="prose prose--wide">
            {enabled ? (
              <>
                <section>
                  <h2>What Google Analytics records</h2>
                  <p>
                    Each time you open a page, Google Analytics records a page
                    view: the page’s address, the page you came from, the page
                    title, your browser, device type and screen size, and an
                    approximate location. Google derives that location from your
                    IP address and says it does not store the address itself. It
                    also records some interactions Google turns on by default,
                    such as scrolling to the end of a page, following a link to
                    another site, and downloading a file such as a CSV export.
                  </p>
                  <p>
                    The page address it receives is cut down first. The register
                    and the relationship explorers keep what you type into their
                    filters in the address bar, so every part of the address
                    after the path is removed before anything is sent, except
                    campaign tags (<code>utm_</code> parameters). A page you
                    arrived from on another site is sent as that site’s address
                    only.
                  </p>
                  <p>
                    It sets two first-party cookies, <code>_ga</code> and{" "}
                    <code>_ga_…</code>, which let it tell a returning browser from
                    a new one. They last up to two years. Google LLC receives and
                    stores the data, and this project keeps it for{" "}
                    {GA4_DATA_RETENTION}.
                  </p>
                </section>

                <section>
                  <h2>What is switched off</h2>
                  <p>
                    Google signals and ad personalization are off, and the
                    advertising consent settings are denied for every reader.
                    Nothing collected here is used to show you ads, joined to a
                    Google account, or sold. This project has no ad account and
                    no other analytics tool.
                  </p>
                </section>

                <section>
                  <h2>Readers in Europe, the UK and Switzerland</h2>
                  <p>
                    If you are in the European Economic Area, the United Kingdom
                    or Switzerland, analytics storage defaults to denied. Google
                    Analytics sets no cookie for you, but it still sends Google a
                    cookieless ping for each page view, without an identifier
                    that links one visit to the next.
                  </p>
                </section>

                <section>
                  <h2>How to turn it off</h2>
                  <p>
                    Google Analytics does not load at all if your browser sends
                    Global Privacy Control or Do Not Track. You can also use the{" "}
                    <strong>Opt out of analytics</strong> button in the footer of
                    every page. It stores <code>{OPT_OUT_STORAGE_KEY}</code> in
                    this browser’s local storage, not in a cookie, and every page
                    checks it before loading anything from Google. It covers this
                    browser on this device only, clearing the site’s data clears
                    it, and it does not delete Google cookies already set. The
                    same button reads <strong>Opt back in</strong> once you have
                    opted out.
                  </p>
                </section>

                <section>
                  <h2>What is never measured</h2>
                  <p>
                    The open-data files, the Atom feeds and{" "}
                    <code>changes.json</code> carry no script, so a program or
                    feed reader that fetches them is not counted. A click on a
                    download link from one of these pages may be counted as a
                    download.
                  </p>
                </section>
              </>
            ) : null}
            <Hosting />
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
