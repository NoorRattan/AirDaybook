export const DELHI_REPLAY = {
  place: "Delhi",
  invocation: {
    date: "2026-11-06",
    aqi: 382,
    url: "https://caqm.nic.in/FileUploadDomain/WebsiteDocument/GRAP/GRAP%20Orders/ec558594-4012-4304-8308-9800770792c2.pdf",
  },
  revocation: {
    date: "2026-11-17",
    aqi: 204,
    url: "https://caqm.nic.in/FileUploadDomain/WebsiteDocument/GRAP/GRAP%20Orders/b91570de-8cc1-4735-8879-28f2bc1550f2.pdf",
  },
  additionalMeasures: {
    date: "2026-10-30",
    starts: "2026-11-05",
    ends: "2026-11-20",
    url: "https://caqm.nic.in/FileUploadDomain/WebsiteDocument/GRAP/GRAP%20Orders/22e7a559-e78f-49b0-b3f6-3f4e93cfa80f.pdf",
  },
} as const;

export function replayDate(date: string, locale: "en-IN" | "hi-IN" = "en-IN", month: "long" | "short" = "long") {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month, year: "numeric" }).format(new Date(date));
}
