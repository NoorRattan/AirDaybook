export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ aiConfiguration }, { releaseId }] = await Promise.all([
    import("./lib/server/ai-config"), import("./lib/server/operations"),
  ]);
  const state = aiConfiguration().kind;
  const event = JSON.stringify({ event: "ai_configuration", release: releaseId(), state });
  if (state === "invalid") console.warn(event);
  else console.info(event);
}
