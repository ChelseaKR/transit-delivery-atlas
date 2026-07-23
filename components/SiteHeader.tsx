import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label="Transit Delivery Atlas home">
          <span className="wordmark__index" aria-hidden="true">N-7-26</span>
          <span>Transit Delivery Atlas</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/#directives">Atlas</Link>
          <Link href="/handoffs">Relationships</Link>
          <Link href="/evidence">Evidence</Link>
          <Link href="/research/tda-ntd">Research</Link>
          <Link href="/methodology">Method</Link>
        </nav>
      </div>
    </header>
  );
}
