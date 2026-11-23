import assert from "node:assert/strict";

export const fixtureKey = "airdaybook-fixture-key";
export const examples = Object.freeze({
  apply: "The fixture household no longer has an air purifier.",
  malformed: "Return the fixture with an invalid provider response.",
  unavailable: "Return the fixture with a provider service error.",
  timeout: "Return the fixture with an unfinished provider response.",
});
export const providerDetail = "fixture-provider-detail";

const endpoint = "https://api.groq.com/openai/v1/chat/completions";
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

if (process.env.AIRDAYBOOK_TEST_PROVIDER === "1") {
  const fetchNetwork = globalThis.fetch;
  globalThis.fetch = async (resource, options) => {
    const url = new URL(resource instanceof Request ? resource.url : resource);
    if (loopbackHosts.has(url.hostname)) return fetchNetwork(resource, options);
    assert.equal(url.href, endpoint, "The fixture never calls an external service.");
    assert.equal(options?.method, "POST");
    assert.equal(new Headers(options.headers).get("authorization"), `Bearer ${fixtureKey}`);

    const payload = JSON.parse(options.body);
    assert.equal(payload.response_format.json_schema.strict, true);
    const submitted = JSON.parse(payload.messages.find(({ role }) => role === "user").content);
    assert.deepEqual(Object.keys(submitted).sort(), ["preferences", "text"]);
    assert.deepEqual(Object.keys(submitted.preferences).sort(), [
      "canCombineErrands", "canMoveActivityIndoors", "hasPurifier", "metroAvailable",
    ]);

    if (submitted.text === examples.unavailable) return new Response(providerDetail, { status: 429 });
    if (submitted.text === examples.timeout) return new Response(new ReadableStream());
    const result = {
      outcome: "apply",
      preferences: {
        hasPurifier: "disable", metroAvailable: "unchanged",
        canMoveActivityIndoors: "unchanged", canCombineErrands: "unchanged",
      },
    };
    if (submitted.text === examples.malformed) result.extra = providerDetail;
    else assert.equal(submitted.text, examples.apply, "Unexpected provider fixture input.");
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }] });
  };
}
