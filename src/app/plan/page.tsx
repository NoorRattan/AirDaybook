import { PlanWorkspace } from "@/components/plan-workspace";
import { pageMetadata } from "@/lib/site-metadata";
import "./plan.css";

export const metadata = pageMetadata("/plan", "My Plan · AirDaybook",
  "Keep fixed commitments, compare outdoor time and travel emissions, plan indoor-air changes, and draft a group note in English or Hindi.");

export default function PlanPage() {
  return <PlanWorkspace />;
}
