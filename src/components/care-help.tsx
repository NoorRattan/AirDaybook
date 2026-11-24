"use client";

import { useLocale } from "./locale";
import { SourceLink } from "./source-link";

export function CareHelp({ solidFuel = false }: { solidFuel?: boolean }) {
  const { language } = useLocale();
  const hindi = language === "hi";
  const title = hindi ? "स्वास्थ्य और आपात सहायता" : "Health and emergency information";
  return (
    <section className={solidFuel ? "routine-warning care-help" : "care-help"} aria-label={title}>
      <h2>{solidFuel
        ? (hindi ? "घर के अंदर खुली लकड़ी या कोयले की आग से बचें" : "Avoid open solid-fuel fires indoors")
        : title}</h2>
      {solidFuel && <p>{hindi
        ? "लकड़ी या कोयले की आग से कार्बन मोनोऑक्साइड बन सकती है। कणों वाला फ़िल्टर इस गैस को नहीं हटाता।"
        : "An open wood or coal fire can release carbon monoxide. A particle filter cannot remove this gas."}</p>}
      <div className="source-links">
        <SourceLink href="https://www.cdc.gov/carbon-monoxide/about/">{hindi ? "कार्बन मोनोऑक्साइड की सुरक्षा जानकारी" : "Carbon monoxide safety guidance"}</SourceLink>
        <a href="tel:112">{hindi ? "भारत में आपात सहायता के लिए 112" : "Emergency assistance in India · 112"}</a>
      </div>
    </section>
  );
}
