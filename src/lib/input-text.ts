export function safeLabel(text: string) {
  return !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text);
}

export function safeMultilineText(text: string) {
  return safeLabel(text.replace(/[\t\r\n]/g, ""));
}

export function containsContactDetails(text: string) {
  const normalized = text.normalize("NFKC").replace(/[०-९]/g, (digit) => String(digit.codePointAt(0)! - 0x966));
  return /\b[^\s@]+@[^\s@]+\.[^\s@]+/u.test(normalized) ||
    /(?<!\d)(?:\+91[ .-]?)?[6-9](?:[ .-]?\d){9}(?!\d)/u.test(normalized) ||
    /(?<!\d)(?:\d[ .-]?){11}\d(?!\d)/u.test(normalized);
}

export function sourceHostname(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/\.$/, "");
    // Imported evidence links are external web names. Do not navigate to literal or local-network addresses.
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !host.includes(".") || /^(?:\d+\.){3}\d+$/.test(host) ||
      /(?:^|\.)(?:localhost|local|lan|internal|home\.arpa)$/.test(host) ||
      /(?:^|\.)xn--/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}
