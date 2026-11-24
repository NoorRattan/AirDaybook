import type { Metadata } from "next";
import localFont from "next/font/local";
import { DraftProvider } from "@/components/draft-provider";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { LocaleProvider, SkipLink } from "@/components/locale";
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
  title: { default: "AirDaybook · Air quality and your day", template: "%s · AirDaybook" },
  description: "A local-first air-quality and daily planning workspace for Delhi-NCR households.",
  applicationName: "AirDaybook",
};

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
