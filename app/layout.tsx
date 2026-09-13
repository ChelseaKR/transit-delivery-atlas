import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ogCard } from "@/lib/og-card";
import {
  OG_CARD_ALT,
  OG_CARD_PATH,
  SITE_DESCRIPTION,
  SITE_LANG,
  SITE_NAME,
  SITE_URL,
  TITLE_TEMPLATE,
} from "@/lib/site";
import "./globals.css";

const display = localFont({
  src: "./fonts/barlow-condensed-latin-700.woff2",
  variable: "--font-display",
  weight: "700",
  style: "normal",
  display: "swap",
});

const body = localFont({
  src: [
    {
      path: "./fonts/atkinson-hyperlegible-latin-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/atkinson-hyperlegible-latin-700.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "public-interest research",
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description:
      "From directive to delivery—making the handoffs visible. Independent analysis; unofficial.",
    images: [
      {
        url: OG_CARD_PATH,
        // Read off the committed PNG rather than stated here, so the tags
        // cannot keep describing an image the file stopped being.
        width: ogCard.width,
        height: ogCard.height,
        alt: OG_CARD_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "An independent, source-linked crosswalk with reviewed public evidence for California Executive Order N-7-26.",
    images: [OG_CARD_PATH],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#102a30",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={SITE_LANG}>
      <body className={`${display.variable} ${body.variable}`}>
        {/*
          The one push channel a site with no accounts, no analytics and no
          subscriptions can offer, declared on every page so a reader's feed
          reader finds it from wherever they landed. Rendered here rather than
          through `metadata.alternates`: every page sets its own
          `alternates.canonical`, which replaces the parent's `alternates`
          entirely, so a feed declared there would have appeared on no page at
          all. React hoists this into the head.
        */}
        <link
          rel="alternate"
          type="application/atom+xml"
          title="Transit Delivery Atlas record changes"
          href="/changes.xml"
        />
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
