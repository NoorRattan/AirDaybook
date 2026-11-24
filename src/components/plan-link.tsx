"use client";

import type { ReactNode } from "react";

export type PlanSection = "schedule" | "routine" | "indoor" | "preferences" | "routes" | "community";

export function PlanLink({ to, children, className }: { to: PlanSection; children: ReactNode; className?: string }) {
  return (
    <a className={className} href={`#${to}`} onClick={(event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      window.requestAnimationFrame(() => {
        const target = document.getElementById(to);
        if (target instanceof HTMLDetailsElement) target.open = true;
        const focus = target instanceof HTMLDetailsElement ? target.querySelector("summary") : target;
        focus?.focus({ preventScroll: true });
      });
    }}>{children}</a>
  );
}
