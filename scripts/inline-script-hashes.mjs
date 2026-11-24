import { createHash } from "node:crypto";

export function inlineScriptHashes(html) {
  const hashes = new Set();
  // Next's generated documents use quoted attributes. Permit HTML whitespace in end tags.
  for (const [, attributes, script] of html.matchAll(/<script(?=[\s/>])((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script(?:[\s/][^>]*)?>/gi)) {
    const external = /(?:^|\s)src(?:\s*=|\s|$)/i.test(attributes.replace(/"[^"]*"|'[^']*'/g, "\"\""));
    if (!external) hashes.add(`'sha256-${createHash("sha256").update(script).digest("base64")}'`);
  }
  return [...hashes];
}
