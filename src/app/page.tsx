import { TodayWorkspace } from "@/components/today-workspace";

export default function TodayPage() {
  return (
    <>
      <link rel="preload" as="image" href="/delhi-metro-dawn-small.webp" media="(max-width: 700px)" fetchPriority="high" />
      <link rel="preload" as="image" href="/delhi-metro-dawn.webp" media="(min-width: 701px)" fetchPriority="high" />
      <TodayWorkspace />
    </>
  );
}
