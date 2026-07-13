import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="not-found" tabIndex={-1}>
        <p className="utility-label">Not found</p>
        <h1>This page does not exist.</h1>
        <p>Return to the Atlas and explore the 21 directive units in signed document order.</p>
        <Link className="button" href="/#directives">Explore directives</Link>
      </main>
      <SiteFooter />
    </>
  );
}
