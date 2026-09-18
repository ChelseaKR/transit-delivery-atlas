# 3. Google Analytics 4 on the pages, guarded and disclosed

## Status

Accepted (owner decision, 2026-09-17)

## Context

Until this decision the site ran no analytics. README said there were "no
accounts, no analytics and no subscriptions", SECURITY.md listed analytics among
the things the project does not have, `docs/DATA-CARD.md` said there were no
trackers on the site, and the CloudFront CSP allowed scripts, connections and
images from this origin only.

On 2026-09-17 the owner decided that every public site in the portfolio runs
Google Analytics 4, with privacy pages and claims changed so nothing published
becomes false. The property was provisioned the same day: GA4 property
554864163, web stream measurement ID `G-SEHF9W5L74`, event data retention 14
months, Google signals disabled on the property.

## Decision

**Where the ID lives.** `GA4_MEASUREMENT_ID` in `lib/analytics.ts`. It is public,
so it is committed as site configuration. `""` turns GA off: `app/layout.tsx`
renders no loader and no page-view component, the footer shows no control, and
`/privacy` says the site runs no analytics. A malformed value throws during the
build.

**When nothing loads.** The inline loader in `<head>` returns before creating
`dataLayer` or requesting gtag.js:

- off `transit.chelseakr.com`, so `npm run dev`, the test build, CI and any
  other copy never contact Google;
- when `navigator.globalPrivacyControl === true`;
- when `navigator.doNotTrack`, `window.doNotTrack` or `navigator.msDoNotTrack`
  is `"1"` or `"yes"`;
- when `localStorage["transit-delivery-atlas:analytics-opt-out"]` is `"1"`,
  which the footer's "Opt out of analytics" control writes. The control
  (`components/AnalyticsChoice.tsx`) also sets Google's own
  `window["ga-disable-G-SEHF9W5L74"]`, so a later route change in the same visit
  sends nothing, and it toggles to "Opt back in". It is a `<button>` because it
  changes a setting, it renders only after hydration because the static HTML
  cannot know the browser's choice, and under GPC, DNT or blocked storage it
  shows no button and says why in its `role="status"` line.

**How it is configured.** Consent Mode v2 defaults deny `ad_storage`,
`ad_user_data` and `ad_personalization` everywhere, and deny `analytics_storage`
through `region` for the 27 EU states, Iceland, Liechtenstein, Norway, the UK
and Switzerland, granting it elsewhere. There is no consent banner, so nothing
updates those defaults; readers in those regions get no GA cookie and gtag
sends Google cookieless pings, which the owner accepted. The config sets
`allow_google_signals: false`, `allow_ad_personalization_signals: false` and
`send_page_view: false`.

**Page views on a client-navigated site.** The site is a Next.js static export
whose links navigate on the client, so after the first page a route change is
not a page load and gtag would not see it. `components/AnalyticsPageViews.tsx`
sends one `page_view` per path change through `sendPageView()`, with:

- `page_location` from `scrubLocation()`: origin and path plus any `utm_*`
  parameters, nothing else. The register and relationship explorers write what
  a reader types into `q`, `bq` and `dq` with `history.replaceState`, so the
  query string can hold arbitrary text, and it never leaves the browser;
- `page_referrer`: the previous scrubbed address within a visit, or, on the
  first view, the origin of an external referrer only;
- `page_title`: the page's own title, which names a directive or a section and
  nothing about the reader.

A filter change rewrites the query string, not the path, and sends nothing.

**CSP.** `infra/static-site.json`'s response-headers policy adds
`https://www.googletagmanager.com` to `script-src` and
`https://*.google-analytics.com https://*.analytics.google.com` to `connect-src`
and `img-src`. That policy is applied by a CloudFormation stack update, not by
the deploy workflow, so until the stack is updated the live CSP blocks gtag.js
and GA records nothing.

**What stays unmeasured.** The open-data exports, the Atom feeds and
`changes.json` carry no script.

## Consequences

- Reading the site now sends Google a page view with the scrubbed page address,
  referrer, title, browser and device data and an approximate location, and
  outside the EEA, UK and Switzerland sets the `_ga` cookies for up to two
  years. `/privacy`, linked from every footer and listed in the sitemap, says
  so, along with retention, the regional behavior, and how to turn it off.
- The rendered-HTML host allowlist gains `www.googletagmanager.com`, the one
  host a page fetches from.
- `tests/analytics.test.mjs` runs the loader in a Node `vm` against stubbed
  browser objects, drives `sendPageView()` and the opt-out helpers, and reads
  the built pages and the CSP. Removing any one guard is caught by a negative
  control that first asserts its sabotage landed.
- **Owner steps in the GA4 web stream.** Enhanced measurement's "Page changes
  based on browser history events" fires on `pushState` and `replaceState` even
  with `send_page_view: false`, and reads the raw URL (measured on
  familygreenhouse.net's container). On this site that would send a second page
  view per route and the explorers' free-text filters. It must be turned off on
  this stream. "Site search" and "Form interactions" have nothing to act on here
  and can be turned off too.
