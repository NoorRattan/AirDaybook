import "server-only";

type JsonRead = { kind: "success"; value: unknown } | { kind: "too_large" | "invalid" | "aborted" };

export async function readBoundedJson(
  message: Request | Response, limit: number, signal: AbortSignal,
): Promise<JsonRead> {
  if (Number(message.headers.get("content-length")) > limit) {
    void message.body?.cancel().catch(() => {});
    return { kind: "too_large" };
  }
  const reader = message.body?.getReader();
  if (!reader) return { kind: "invalid" };
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    if (signal.aborted) return { kind: "aborted" };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) return { kind: "too_large" };
      text += decoder.decode(value, { stream: true });
    }
    return signal.aborted ? { kind: "aborted" } : { kind: "success", value: JSON.parse(text + decoder.decode()) };
  } catch {
    return { kind: signal.aborted ? "aborted" : "invalid" };
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel();
    reader.releaseLock();
  }
}
