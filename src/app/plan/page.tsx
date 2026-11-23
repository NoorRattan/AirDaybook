import type { Metadata } from "next";
import { PlanWorkspace } from "@/components/plan-workspace";

export const metadata: Metadata = { title: "My Plan" };

export default function PlanPage() {
  return <PlanWorkspace />;
}
