"use client";

import type { ReactNode } from "react";

export type PlanSection = "schedule" | "preferences" | "routes" | "community";

export function PlanLink({ to, children }: { to: PlanSection; children: ReactNode }) {
  return (
    <a href={`#${to}`} onClick={(event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      window.requestAnimationFrame(() => {
        const target = document.getElementById(to);
        const focus = target instanceof HTMLDetailsElement ? target.querySelector("summary") : target;
        focus?.focus({ preventScroll: true });
      });
    }}>{children}</a>
  );
}
