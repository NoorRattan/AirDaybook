"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useDraft } from "./draft-provider";

type AppLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onNavigate" | "prefetch"> & {
  href: "/" | "/plan";
};

export function AppLink({ href, ...props }: AppLinkProps) {
  const { finishDraftWrite } = useDraft();
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onNavigate={(event) => {
        if (navigator.onLine || !navigator.serviceWorker?.controller) return;
        event.preventDefault();
        void finishDraftWrite().then(() => window.location.assign(href));
      }}
    />
  );
}
