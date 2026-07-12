import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="utility-label">Independent analysis · Unofficial</p>
          <p>
            Not an official State of California publication. Analytical content
            is not an implementation status or legal conclusion.
          </p>
        </div>
        <div className="site-footer__links">
          <Link href="/methodology">Methodology</Link>
          <Link href="/data">Open data</Link>
          <Link href="/accessibility">Accessibility</Link>
          <a
            href="https://www.gov.ca.gov/wp-content/uploads/2026/06/ATTESTED_6.26-Transit-EO_FINAL_SIGNED.pdf"
            rel="noreferrer"
          >
            Signed source (scanned, untagged PDF)
          </a>
        </div>
      </div>
    </footer>
  );
}
