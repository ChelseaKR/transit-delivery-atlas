import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible,
  Barlow_Condensed,
} from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

const body = Atkinson_Hyperlegible({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Transit Delivery Atlas",
    template: "%s | Transit Delivery Atlas",
  },
  description:
    "Independent, source-linked crosswalk of California Executive Order N-7-26 directives, named entities, timing, dependencies, and open questions.",
  applicationName: "Transit Delivery Atlas",
  category: "public-interest research",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Transit Delivery Atlas",
    title: "Transit Delivery Atlas",
    description:
      "From directive to delivery—making the handoffs visible. Independent analysis; unofficial.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Transit Delivery Atlas handoff rail from source to entity, timing, and analysis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Transit Delivery Atlas",
    description:
      "An independent, source-linked crosswalk for California Executive Order N-7-26.",
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
