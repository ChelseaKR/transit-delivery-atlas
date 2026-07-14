import Link from "next/link";
import { CORRECTION_CHOOSER_URL } from "@/lib/feedback";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="utility-label">Independent analysis · Unofficial</p>
          <p>
            Not an official State of California publication. Public evidence is
            selective, and analytical content is not an implementation status
            or legal conclusion.
          </p>
        </div>
        <div className="site-footer__links">
          <Link href="/corrections">Corrections and review</Link>
          <Link href="/handoffs">Delivery relationships</Link>
          <Link href="/evidence">Public evidence</Link>
          <Link href="/methodology">Methodology</Link>
          <Link href="/research/tda-ntd">TDA/NTD research</Link>
          <Link href="/data">Open data</Link>
          <Link href="/accessibility">Accessibility</Link>
          <a href={CORRECTION_CHOOSER_URL} rel="noreferrer">
            Suggest a correction <span aria-hidden="true">↗</span>
          </a>
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
