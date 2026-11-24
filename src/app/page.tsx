import { TodayWorkspace } from "@/components/today-workspace";
import { preload } from "react-dom";
import { desktopHeroMedia, hero, mobileHeroMedia } from "@/lib/hero-assets";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata("/", "AirDaybook · Air quality and your day",
  "Check air quality for your city and plan around winter smog. Compare household, travel and outdoor options with AirDaybook’s offline planner and AI assistant.");

export default function TodayPage() {
  preload(hero.mobileAvif.src, { as: "image", type: "image/avif", media: mobileHeroMedia, fetchPriority: "high" });
  preload(hero.desktopAvif.src, { as: "image", type: "image/avif", media: desktopHeroMedia, fetchPriority: "high" });
  return <TodayWorkspace />;
}
