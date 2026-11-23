"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function PlanTool({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === `#${id}` && details.current) details.current.open = true;
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [id]);

  return (
    <details id={id} ref={details} className="plan-tool" onToggle={(event) => {
      if (event.currentTarget.open) setLoaded(true);
      else if (window.location.hash === `#${id}`) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }}>
      <summary>
        <span><span className="section-title">{title}</span><span className="tool-description">{description}</span></span>
        <ChevronDown size={20} aria-hidden />
      </summary>
      {loaded && <div className="tool-content">{children}</div>}
    </details>
  );
}
