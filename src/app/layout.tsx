import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { DraftProvider } from "@/components/draft-provider";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { LocaleProvider, SkipLink } from "@/components/locale";
import { siteOrigin } from "@/lib/site-metadata";
import "./globals.css";

const display = localFont({
  src: "./fonts/instrument-serif.woff2",
  weight: "400",
  variable: "--journal-display",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const body = localFont({
  src: "./fonts/dm-sans.woff2",
  variable: "--journal-body",
  weight: "100 1000",
  preload: false,
  display: "optional",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Page not found · AirDaybook",
  applicationName: "AirDaybook",
  manifest: "/manifest.webmanifest",
  icons: { apple: [{ url: "/icons/apple-touch-v1.png", sizes: "180x180" }] },
};
export const viewport: Viewport = { themeColor: "#175b50" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <LocaleProvider>
          <SkipLink />
          <DraftProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
          </DraftProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
