"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Waves } from "lucide-react";
import { SOURCES } from "@/lib/readings";

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="shell nav-inner">
        <Link href="/" prefetch={false} className="brand" aria-label="AirDaybook home">
          <span className="brand-mark"><Waves size={21} strokeWidth={1.9} aria-hidden /></span>
          <span>AirDaybook<span className="brand-stop">.</span></span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/" prefetch={false} aria-current={path === "/" ? "page" : undefined}>Today</Link>
          <Link href="/plan" prefetch={false} aria-current={path === "/plan" ? "page" : undefined}>My Plan</Link>
        </nav>
        <a className="official-link" href={SOURCES.cpcb} target="_blank" rel="noreferrer">
          CPCB readings <ArrowUpRight size={14} aria-hidden />
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer shell">
      <div className="footer-name"><Waves size={18} aria-hidden /> AirDaybook</div>
      <p>Delhi-NCR · Air quality and daily planning</p>
    </footer>
  );
}
