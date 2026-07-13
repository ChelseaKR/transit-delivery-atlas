import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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
  metadataBase: new URL("https://transit.chelseakr.com"),
  title: {
    default: "Transit Delivery Atlas",
    template: "%s | Transit Delivery Atlas",
  },
  description:
    "Independent, source-linked crosswalk of California Executive Order N-7-26 directives, named entities, timing, reviewed public evidence, dependencies, and open questions.",
  applicationName: "Transit Delivery Atlas",
  category: "public-interest research",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Transit Delivery Atlas",
    title: "Transit Delivery Atlas",
    description:
      "From directive to delivery—making the handoffs visible. Independent analysis; unofficial.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Transit Delivery Atlas handoff rail from source to entity, timing, public evidence, and analysis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Transit Delivery Atlas",
    description:
      "An independent, source-linked crosswalk with reviewed public evidence for California Executive Order N-7-26.",
    images: ["/og.png"],
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
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
