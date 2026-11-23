import type { Metadata } from "next";
import localFont from "next/font/local";
import { DraftProvider } from "@/components/draft-provider";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import "./globals.css";

const display = localFont({
  src: "../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2",
  weight: "400",
  variable: "--journal-display",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const body = localFont({
  src: "../../node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2",
  variable: "--journal-body",
  weight: "100 1000",
  preload: false,
  display: "swap",
});

const mono = localFont({
  src: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
  variable: "--journal-mono",
  weight: "500",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "AirDaybook · Air quality and your day", template: "%s · AirDaybook" },
  description: "A local-first air-quality and daily planning workspace for Delhi-NCR households.",
  applicationName: "AirDaybook",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <DraftProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
        </DraftProvider>
      </body>
    </html>
  );
}
