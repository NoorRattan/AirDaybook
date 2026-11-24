import { useLocale } from "./locale";
import { CalendarClock, House, Map } from "lucide-react";
import type { planningActions } from "@/lib/planning-actions";
import { PlanLink } from "./plan-link";
import { SourceLink } from "./source-link";

const icons = { schedule: CalendarClock, home: House, travel: Map };

export function PlanningActions({ result }: { result: ReturnType<typeof planningActions> }) {
  const { t } = useLocale();
  return (
    <section className="plan-actions" aria-labelledby="plan-actions-title">
      <h2 id="plan-actions-title" className="section-title">{t("What you can change")}</h2>
      <p className="planning-context">{result.context}</p>
      <ul>
        {result.actions.map(({ area, title, description, source }) => {
          const Icon = icons[area];
          return (
            <li key={title}>
              <Icon size={19} aria-hidden />
              <div>
                <h3>{title}</h3>
                <p>{description} {source && <SourceLink href={source.url}>{t(source.label)}</SourceLink>}
                  {area === "schedule" && <PlanLink to="schedule">Edit your schedule</PlanLink>}
                  {area === "travel" && <PlanLink to="routes">Compare routes</PlanLink>}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
