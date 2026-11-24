"use client";

import { AppLink } from "@/components/app-link";

export default function RouteError({ reset }: { reset: () => void }) {
  return (
    <main className="shell journal-shell route-fallback" id="main-content">
      <h1>This page couldn’t finish loading</h1>
      <div className="form-actions">
        <button className="button button-primary" onClick={reset}>Try again</button>
        <AppLink className="button button-subtle" href="/">Open Today</AppLink>
      </div>
    </main>
  );
}
