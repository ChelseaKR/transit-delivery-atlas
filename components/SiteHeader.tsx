import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="wordmark" href="/" aria-label="Transit Delivery Atlas home">
          <span className="wordmark__mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>Transit Delivery Atlas</span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/#directives">Directives</Link>
          <Link href="/handoffs">Relationships</Link>
          <Link href="/evidence">Evidence</Link>
          <Link href="/methodology">Method</Link>
          <Link href="/research/tda-ntd">Research</Link>
          <Link href="/data">Data</Link>
          <Link href="/accessibility">Accessibility</Link>
        </nav>
      </div>
    </header>
  );
}
