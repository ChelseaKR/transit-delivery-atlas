import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="not-found" tabIndex={-1}>
        <p className="utility-label">Not found</p>
        <h1>This directive page does not exist.</h1>
        <p>Return to the signed document order and choose one of the 21 directive units.</p>
        <Link className="button" href="/#directives">Explore directives</Link>
      </main>
      <SiteFooter />
    </>
  );
}
