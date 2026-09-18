/**
 * Google Analytics 4 on the published pages (ADR 0003).
 *
 * The owner decided on 2026-09-17 to run GA4 on every public site in the
 * portfolio, with the privacy copy changed to match. This module is the one
 * place that decision is implemented, and `GA4_MEASUREMENT_ID` is the one place
 * the property's measurement ID lives. The ID is public (every page that loads
 * GA hands it to the browser), so it is committed as site configuration. Set it
 * to `""` and the build carries no loader, the footer offers no control, and
 * `/privacy/` says the site runs no analytics.
 *
 * Three pieces, each small enough to test on its own:
 *
 * - `loaderScript()` is the inline `<head>` script `app/layout.tsx` renders.
 *   It loads nothing unless the page is served from `PRODUCTION_HOST` (so no
 *   local, test or CI build contacts Google), and nothing when the browser sends
 *   Global Privacy Control or Do Not Track, or the reader has opted out in the
 *   footer. Otherwise it sets Consent Mode v2 defaults (ad signals denied
 *   everywhere, `analytics_storage` denied in the EEA, the UK and Switzerland),
 *   configures GA4 with Google signals and ad personalization off, and loads
 *   gtag.js.
 * - `sendPageView()` is what `components/AnalyticsPageViews.tsx` calls on every
 *   route change. The site is a Next.js static export whose links navigate on
 *   the client, so a route change is not a page load and gtag would not see it.
 *   The loader turns gtag's own page view off (`send_page_view: false`) and this
 *   sends one per route instead, with the address scrubbed by `scrubLocation()`:
 *   the explorers write what a reader types into the query string (`q`, `bq`,
 *   `dq`), so every parameter except `utm_*` is dropped before anything leaves
 *   the browser.
 * - `choiceSnapshot()` and `setOptedOut()` back the footer's "Opt out of
 *   analytics" control (`components/AnalyticsChoice.tsx`).
 */

/** The one place the measurement ID goes. `""` means no GA anywhere. */
export const GA4_MEASUREMENT_ID = "G-SEHF9W5L74";

/** What `/privacy/` tells a reader about retention; it must match the property. */
export const GA4_DATA_RETENTION = "14 months";

/** The only hostname the loader runs on. */
export const PRODUCTION_HOST = "transit.chelseakr.com";

/**
 * The footer's opt-out, remembered per browser under this `localStorage` key and
 * read before gtag.js is ever requested. Renaming it would silently opt every
 * opted-out reader back in, so it is never renamed.
 */
export const OPT_OUT_STORAGE_KEY = "transit-delivery-atlas:analytics-opt-out";

export const GTAG_JS_URL = "https://www.googletagmanager.com/gtag/js";

/**
 * `analytics_storage` defaults to denied for readers in these regions (ISO
 * 3166-1 alpha-2): the 27 EU member states, Iceland, Liechtenstein and Norway,
 * the United Kingdom, and Switzerland.
 */
export const ANALYTICS_DENIED_REGIONS: readonly string[] = Object.freeze([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO", "GB", "CH",
]);

/** The footer's status line after each state change, announced by its live region. */
export const OPT_OUT_MESSAGES = Object.freeze({
  optedOut:
    "Opted out. From the next page you load, this site will not load Google Analytics in this browser.",
  isOut: "You have opted out: this site does not load Google Analytics in this browser.",
  backIn: "Opted back in. Analytics resumes from the next page you load.",
  signal: "Analytics is off: your browser sends Global Privacy Control or Do Not Track.",
  noStorage:
    "This browser is blocking site storage, so an opt-out cannot be remembered here. Global Privacy Control or Do Not Track keeps analytics off.",
});

const MEASUREMENT_ID = /^G-[A-Z0-9]{4,20}$/;

/**
 * `null` for an unset or blank ID, the ID itself when it is well formed. Anything
 * else throws rather than being written into a script: a typo fails the build.
 */
export function measurementId(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  if (!MEASUREMENT_ID.test(trimmed)) {
    throw new Error(`not a GA4 measurement ID (expected G-XXXXXXXXXX): ${JSON.stringify(value)}`);
  }
  return trimmed;
}

/** Whether this build carries GA4 at all. */
export function analyticsEnabled(id: string = GA4_MEASUREMENT_ID): boolean {
  return measurementId(id) !== null;
}

/** The inline `<head>` loader, or `""` when no ID is configured. */
export function loaderScript(id: string = GA4_MEASUREMENT_ID): string {
  const mid = measurementId(id);
  if (mid === null) return "";
  const json = (value: unknown) => JSON.stringify(value);
  return `(function () {
  var w = window, n = navigator, d = document;
  if (w.location.hostname !== ${json(PRODUCTION_HOST)}) return;
  if (n.globalPrivacyControl === true) return;
  var dnt = n.doNotTrack || w.doNotTrack || n.msDoNotTrack;
  if (dnt === "1" || dnt === "yes") return;
  try { if (w.localStorage.getItem(${json(OPT_OUT_STORAGE_KEY)}) === "1") return; } catch (e) {}
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = gtag;
  gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    analytics_storage: "denied", region: ${json(ANALYTICS_DENIED_REGIONS)}
  });
  gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    analytics_storage: "granted"
  });
  gtag("js", new Date());
  gtag("config", ${json(mid)}, {
    allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: false
  });
  var s = d.createElement("script");
  s.async = true;
  s.src = ${json(`${GTAG_JS_URL}?id=${mid}`)};
  d.head.appendChild(s);
})();`;
}

/** Campaign parameters are the only part of a query string GA is ever sent. */
const KEPT_PARAMETER = /^utm_(?:source|medium|campaign|term|content|id)$/;

/**
 * The page address as GA receives it: origin and path, plus any `utm_*`
 * parameters, and nothing else. No fragment, and none of the explorers'
 * free-text filters, which hold whatever a reader typed.
 */
export function scrubLocation(href: string): string {
  const url = new URL(href);
  const kept = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (KEPT_PARAMETER.test(key)) kept.append(key, value);
  }
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

/**
 * The referrer for the first page view of a visit: another site is reduced to
 * its origin, since its path and query are that site's business; a page of this
 * site is scrubbed the same way as the location. Anything unparseable is dropped.
 */
export function scrubReferrer(referrer: string, origin: string): string {
  if (!referrer) return "";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "";
  }
  return url.origin === origin ? scrubLocation(referrer) : `${url.origin}/`;
}

type Gtag = (...args: unknown[]) => void;

export interface PageViewWindow {
  gtag?: Gtag;
  location: { href: string; origin: string };
}

/**
 * Send one scrubbed `page_view` for the current route, if the loader ran.
 *
 * `previous` is the scrubbed address of the last page view this tab sent, or
 * `null` on the first; it becomes the referrer, because a client-side
 * navigation leaves `document.referrer` pointing at wherever the visit began.
 * Returns the address to pass as `previous` next time. When the loader did not
 * run (off-host, GPC, DNT, opted out) there is no `gtag` and nothing is sent.
 */
export function sendPageView(
  win: PageViewWindow,
  doc: { title: string; referrer: string },
  previous: string | null,
): string | null {
  if (typeof win.gtag !== "function") return previous;
  const location = scrubLocation(win.location.href);
  if (location === previous) return previous;
  win.gtag("event", "page_view", {
    page_location: location,
    page_referrer: previous ?? scrubReferrer(doc.referrer, win.location.origin),
    page_title: doc.title,
  });
  return location;
}

interface SignalSource {
  navigator: { globalPrivacyControl?: unknown; doNotTrack?: unknown; msDoNotTrack?: unknown };
  doNotTrack?: unknown;
}

/** Whether the browser sends Global Privacy Control or Do Not Track. */
export function privacySignal(win: SignalSource): boolean {
  const n = win.navigator;
  const dnt = n.doNotTrack || win.doNotTrack || n.msDoNotTrack;
  return n.globalPrivacyControl === true || dnt === "1" || dnt === "yes";
}

type OptOutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** This browser's `localStorage`, or `null` when reading it throws. */
export function readStorage(win: { localStorage: OptOutStorage }): OptOutStorage | null {
  try {
    const storage = win.localStorage;
    storage.getItem(OPT_OUT_STORAGE_KEY);
    return storage;
  } catch {
    return null;
  }
}

/** `"signal"`, `"no-storage"`, `"out"` or `"in"`: what the footer control shows. */
export type ChoiceSnapshot = "signal" | "no-storage" | "out" | "in";

export function choiceSnapshot(win: SignalSource & { localStorage: OptOutStorage }): ChoiceSnapshot {
  if (privacySignal(win)) return "signal";
  const storage = readStorage(win);
  if (storage === null) return "no-storage";
  return storage.getItem(OPT_OUT_STORAGE_KEY) === "1" ? "out" : "in";
}

/**
 * Record the reader's choice and tell gtag at once, through Google's own
 * `window["ga-disable-<ID>"]` property, so a later route change in this visit
 * sends nothing. Throws if storage refuses the write; the caller says so.
 */
export function setOptedOut(
  storage: OptOutStorage,
  win: object,
  optedOut: boolean,
  id: string = GA4_MEASUREMENT_ID,
): void {
  if (optedOut) storage.setItem(OPT_OUT_STORAGE_KEY, "1");
  else storage.removeItem(OPT_OUT_STORAGE_KEY);
  const mid = measurementId(id);
  if (mid !== null) (win as Record<string, unknown>)[`ga-disable-${mid}`] = optedOut;
}
