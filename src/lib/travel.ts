export const travelModes = ["road", "metro", "walk-cycle", "other"] as const;
export const vehicleTypes = ["open", "enclosed", "mixed"] as const;
export const trafficLevels = ["light", "heavy", "mixed"] as const;

export type Trip = {
  mode: (typeof travelModes)[number] | null;
  vehicle: (typeof vehicleTypes)[number] | null;
  traffic: (typeof trafficLevels)[number] | null;
  walking: number | null;
  waiting: number | null;
  outdoorWaiting: number | null;
  riding: number | null;
};

export type TravelComparison = {
  current: Trip;
  alternative: Trip;
  averageRoadBaseline: boolean;
  metroKm: number | null;
};

export const metroMethods = [
  { label: "Method 1", gramsPerKm: 23.82 },
  { label: "Method 2 · DMRC CarbonLite", gramsPerKm: 32.38 },
] as const;

export const metroSources = {
  teri: "https://www.teriin.org/sites/default/transport/Per_passenger_emission_in_Delhi_Different_Modes.pdf#page=9",
  dmrc: "https://delhimetrorail.com/carbonlite-metro-travel",
} as const;

export function tripTimes({ walking, waiting, outdoorWaiting, riding }: Trip) {
  return {
    total: walking === null || waiting === null || riding === null ? null : walking + waiting + riding,
    outdoors: walking === null || (outdoorWaiting === null && waiting !== 0) ? null : walking + (outdoorWaiting ?? 0),
  };
}

export function metroSavings({ current, alternative, averageRoadBaseline, metroKm }: TravelComparison) {
  if (current.mode !== "road" || alternative.mode !== "metro" || !averageRoadBaseline || metroKm === null) return null;
  return metroMethods.map((method) => ({
    ...method,
    kg: metroKm * (method.gramsPerKm / 1000),
  }));
}
