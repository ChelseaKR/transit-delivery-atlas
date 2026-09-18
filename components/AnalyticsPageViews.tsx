"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { sendPageView } from "@/lib/analytics";

/**
 * One scrubbed GA4 `page_view` per route (ADR 0003).
 *
 * Links on this static export navigate on the client, so gtag never sees a page
 * load after the first one; its own page view is turned off in the loader and
 * this sends one when the path changes instead. A filter the explorers write
 * into the query string changes no path and sends nothing. When the loader did
 * not run (off the production host, GPC, DNT, or opted out) there is no
 * `window.gtag` and this does nothing.
 */
export function AnalyticsPageViews() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    previous.current = sendPageView(window, document, previous.current);
  }, [pathname]);

  return null;
}
