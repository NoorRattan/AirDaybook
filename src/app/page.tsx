import { TodayWorkspace } from "@/components/today-workspace";

export default function TodayPage() {
  return (
    <>
      <link rel="preload" as="image" type="image/avif" href="/delhi-metro-dawn-small.avif" media="(max-width: 700px)" fetchPriority="high" />
      <link rel="preload" as="image" type="image/avif" href="/delhi-metro-dawn.avif" media="(min-width: 701px)" fetchPriority="high" />
      <TodayWorkspace />
    </>
  );
}
