import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { inlineScriptHashes } from "../scripts/inline-script-hashes.mjs";

test("CSP hashes cover inline scripts with legal end-tag whitespace and ignore external scripts", () => {
  const html = `<script SRC = '/bundle.js'></script><script data-src='>'>first</script \n><SCRIPT>second</SCRIPT\t><script>first</script><script-like>ignored</script-like>`;
  const expected = ["first", "second"].map((value) => `'sha256-${createHash("sha256").update(value).digest("base64")}'`);
  assert.deepEqual(inlineScriptHashes(html), expected);
});
