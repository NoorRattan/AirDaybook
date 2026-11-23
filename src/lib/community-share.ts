import { isStaleObservation, observationTime, readingView, SOURCES, type ReadingSelection } from "./readings";
import { DELHI_REPLAY, replayDate } from "./replay";

const { invocation, revocation, additionalMeasures } = DELHI_REPLAY;
const orders = [invocation.url, revocation.url, additionalMeasures.url].join("\n");

const shareCopy = {
  en: {
    title: "AirDaybook · Community note",
    context: "Group activity",
    action: "Group action",
    missing: "No air quality reading selected.",
    city: "City reading",
    station: "Station reading",
    observed: "Observed",
    manual: "Manually entered",
    imported: "Imported from a user-supplied file",
    stale: "Stale reading",
    source: "Source",
    scale: { india_naqi: "Indian AQI", us_aqi: "US AQI", unknown: "AQI (scale unspecified)" },
    basis: { overall: "overall", pollutant_subindex: "pollutant sub-index", unknown: "basis unspecified" },
    replay: [
      `Historical replay · Delhi city AQI ${invocation.aqi} · ${replayDate(invocation.date)}`,
      `CAQM invoked GRAP Stage III ahead of forecast Severe conditions. On ${replayDate(revocation.date)}, CAQM revoked Stage III after Delhi reported AQI ${revocation.aqi}. Stage I and II remained in force as of that date. A separate order scheduled additional measures from ${replayDate(additionalMeasures.starts)} to ${replayDate(additionalMeasures.ends)}.`,
      "The Stage III invocation has been superseded.",
      `CAQM orders: ${orders}`,
    ],
    check: "Check CPCB for a recent local reading before confirming the group plan.",
  },
  hi: {
    title: "AirDaybook · समूह के लिए सूचना",
    context: "समूह की गतिविधि",
    action: "समूह के लिए तय कदम",
    missing: "वायु गुणवत्ता का कोई माप चुना नहीं गया है।",
    city: "शहर का माप",
    station: "निगरानी केंद्र का माप",
    observed: "माप का समय",
    manual: "खुद दर्ज किया गया माप",
    imported: "उपयोगकर्ता की फ़ाइल से लिया गया माप",
    stale: "पुराना माप",
    source: "स्रोत",
    scale: { india_naqi: "भारतीय AQI", us_aqi: "अमेरिकी AQI", unknown: "AQI (पैमाना उपलब्ध नहीं है)" },
    basis: { overall: "समग्र", pollutant_subindex: "किसी एक प्रदूषक का उप-सूचकांक", unknown: "आधार उपलब्ध नहीं है" },
    replay: [
      `ऐतिहासिक रिकॉर्ड · दिल्ली शहर का AQI ${invocation.aqi} · ${replayDate(invocation.date, "hi-IN")}`,
      `वायु गुणवत्ता ‘गंभीर’ श्रेणी में पहुँचने के पूर्वानुमान पर CAQM ने GRAP का चरण III लागू किया। ${replayDate(revocation.date, "hi-IN")} को दिल्ली का AQI ${revocation.aqi} दर्ज होने के बाद CAQM ने चरण III हटा लिया। उस दिन चरण I और II लागू रहे। एक अलग आदेश में ${replayDate(additionalMeasures.starts, "hi-IN")} से ${replayDate(additionalMeasures.ends, "hi-IN")} तक अतिरिक्त उपाय तय किए गए थे।`,
      "चरण III लागू करने वाला यह आदेश अब प्रभावी नहीं है।",
      `CAQM के आदेश: ${orders}`,
    ],
    check: "समूह की योजना पक्की करने से पहले CPCB पर अपने इलाके का हाल का माप देखें।",
  },
} as const;

export type ShareLanguage = keyof typeof shareCopy;

export function communityNote({ selection, now, language, context, action, includeLabels }: {
  selection: ReadingSelection;
  now: number;
  language: ShareLanguage;
  context: string;
  action: string;
  includeLabels: boolean;
}) {
  const copy = shareCopy[language];
  const sections: string[] = [copy.title];
  if (context.trim()) sections.push(`${copy.context}: ${context.trim()}`);

  const reading = readingView(selection, now);
  if (selection === "replay") {
    sections.push(copy.replay.join("\n"));
  } else if (selection && reading) {
    const { location, observedAt, metric } = selection.observation;
    const scope = location.scope === "city" ? copy.city : copy.station;
    const datedStatus = [
      selection.kind === "manual" ? copy.manual : copy.imported,
      ...(isStaleObservation(observedAt, now) ? [copy.stale] : []),
    ];
    const measurement = metric.kind === "aqi"
      ? `${reading.value} ${copy.scale[metric.scale]} · ${copy.basis[metric.basis]}`
      : `PM₂.₅ ${reading.value} ${reading.unit}`;
    const lines = [
      includeLabels ? `${scope} · ${reading.place.replace(/\s+/g, " ")}` : scope,
      measurement,
      `${copy.observed}: ${observationTime(observedAt, language === "hi" ? "hi-IN" : "en-IN")}`,
      datedStatus.join(" · "),
    ];
    if (includeLabels) lines.push(`${copy.source}: ${reading.source.replace(/\s+/g, " ")}`);
    sections.push(lines.join("\n"));
  } else {
    sections.push(copy.missing);
  }

  if (action.trim()) sections.push(`${copy.action}: ${action.trim()}`);
  sections.push(`${copy.check}\n${SOURCES.cpcb}`);
  return sections.join("\n\n");
}
