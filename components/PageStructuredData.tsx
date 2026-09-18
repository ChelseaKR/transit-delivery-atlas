import { structuredData } from "@/lib/structured-data";

/**
 * The machine-readable half of a page's head, rendered from the same route
 * record the human-readable half is rendered from.
 *
 * Takes the path rather than the assembled node so that a page cannot hand this
 * component one description while exporting another to Next.js.
 */
export function PageStructuredData({ path }: { path: string }) {
  return (
    <script
      type="application/ld+json"
      // The payload is JSON this build produced, with every markup-initiating
      // character escaped in `structuredData`.
      dangerouslySetInnerHTML={{ __html: structuredData(path) }}
    />
  );
}
