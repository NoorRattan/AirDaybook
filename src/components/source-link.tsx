"use client";

import type { ReactNode } from "react";
import { useLocale } from "./locale";

export function SourceLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const { t } = useLocale();
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}<span className="sr-only"> {t("(opens in a new tab)")}</span>
    </a>
  );
}
