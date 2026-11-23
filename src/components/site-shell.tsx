"use client";

import { usePathname } from "next/navigation";
import { Waves } from "lucide-react";
import { SOURCES } from "@/lib/readings";
import { AppLink } from "./app-link";
import { OfflineStatus } from "./offline-status";

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="shell nav-inner">
        <AppLink href="/" className="brand" aria-label="AirDaybook home">
          <span className="brand-mark"><Waves size={21} strokeWidth={1.9} aria-hidden /></span>
          <span>AirDaybook</span>
        </AppLink>
        <nav className="main-nav" aria-label="Main navigation">
          <AppLink href="/" aria-current={path === "/" ? "page" : undefined}>Today</AppLink>
          <AppLink href="/plan" aria-current={path === "/plan" ? "page" : undefined}>My Plan</AppLink>
        </nav>
        <a className="official-link" href={SOURCES.cpcb} target="_blank" rel="noreferrer">
          CPCB readings
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer shell">
      <div className="footer-name"><Waves size={18} aria-hidden /> AirDaybook</div>
      <OfflineStatus />
    </footer>
  );
}
