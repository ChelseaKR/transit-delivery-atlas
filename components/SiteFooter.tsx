import Image from "next/image";
import Link from "next/link";
import { AnalyticsChoice } from "@/components/AnalyticsChoice";
import { analyticsEnabled } from "@/lib/analytics";
import { CORRECTION_CHOOSER_URL } from "@/lib/feedback";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__statement">
          <p className="utility-label">Independent analysis · Unofficial</p>
          <p>
            Not an official State of California publication. Public evidence
            and the context watchlist are selective; watchlist and analytical
            content are not implementation evidence, status, or legal
            conclusions.
          </p>
          {analyticsEnabled() ? (
            <div className="site-footer__privacy">
              <p>
                Pages use Google Analytics 4 to count visits, with its
                advertising features off. It does not load when your browser
                sends Global Privacy Control or Do Not Track.{" "}
                <Link href="/privacy">What it records</Link>.
              </p>
              <AnalyticsChoice />
            </div>
          ) : (
            <div className="site-footer__privacy">
              <p>
                This site runs no analytics and sets no cookies.{" "}
                <Link href="/privacy">Privacy</Link>.
              </p>
            </div>
          )}
        </div>
        <div className="site-footer__directory">
          <nav className="site-footer__links" aria-label="Footer navigation">
            <Link href="/corrections">Corrections and review</Link>
            <Link href="/handoffs">Delivery relationships</Link>
            <Link href="/evidence">Public evidence</Link>
            <Link href="/watchlist">Context watchlist</Link>
            <Link href="/methodology">Methodology</Link>
            <Link href="/research/tda-ntd">TDA/NTD research</Link>
            <Link href="/data">Open data</Link>
            <Link href="/accessibility">Accessibility</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
          <div className="site-footer__actions">
            <a href={CORRECTION_CHOOSER_URL} rel="noreferrer">
              Suggest a correction <span aria-hidden="true">↗</span>
            </a>
            <a
              href="https://www.gov.ca.gov/wp-content/uploads/2026/06/ATTESTED_6.26-Transit-EO_FINAL_SIGNED.pdf"
              rel="noreferrer"
            >
              Signed source PDF <span aria-hidden="true">↗</span>
            </a>
            {/* Self-hosted button image: the site's CSP allows images only from
                this origin and GA's collection hosts, so Ko-fi's CDN copy would be
                blocked, and serving it locally also keeps Ko-fi from seeing who
                reads this site. */}
            <a
              href="https://ko-fi.com/T6T6GMYTU"
              target="_blank"
              rel="noreferrer noopener"
              className="site-footer__kofi"
            >
              <Image
                src="/kofi.png"
                alt="Support this work on Ko-fi"
                width={116}
                height={29}
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
