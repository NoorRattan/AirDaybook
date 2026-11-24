import { cityPreset, estimateSource } from "@/lib/city-estimates";
import { validateObservation } from "@/lib/observation-schema";

export async function GET(request: Request) {
  const city = cityPreset(new URL(request.url).searchParams.get("city"));
  if (!city) return Response.json({ error: "unknown_city" }, { status: 400 });
  const [label, latitude, longitude] = city;
  const upstream = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  upstream.search = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    current: "pm2_5", domains: "cams_global", timezone: "GMT",
  }).toString();
  try {
    const reply = await fetch(upstream, { next: { revalidate: 900 }, signal: AbortSignal.timeout(4500), redirect: "error" });
    if (!reply.ok) throw new Error("Estimate unavailable");
    const { current, current_units } = await reply.json();
    if (current_units?.pm2_5 !== "μg/m³" || typeof current?.time !== "string") throw new Error("Unexpected estimate unit");
    const validated = validateObservation({
      schemaVersion: 1, location: { label, scope: "city" }, source: estimateSource,
      observedAt: current.time + "Z",
      metric: { kind: "pm25", value: current.pm2_5, unit: "ug_m3", averagingMinutes: null },
    });
    if (!("observation" in validated)) throw new Error("Invalid estimate");
    return Response.json(validated.observation, { headers: { "Cache-Control": "public, max-age=60, s-maxage=900" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
