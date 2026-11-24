import { AppLink } from "@/components/app-link";

export default function NotFound() {
  return (
    <main className="shell journal-shell route-fallback" id="main-content">
      <h1>Page not found</h1>
      <div className="form-actions">
        <AppLink className="button button-primary" href="/">Open Today</AppLink>
        <AppLink className="button button-subtle" href="/plan">Open My Plan</AppLink>
      </div>
    </main>
  );
}
