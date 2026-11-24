export const travelModes = ["road", "metro", "walk-cycle", "other", "two-wheeler", "carpool", "bus", "electric-bus", "auto", "electric-car", "rail", "no-trip"] as const;
export const vehicleTypes = ["open", "enclosed", "mixed"] as const;
export const trafficLevels = ["light", "heavy", "mixed"] as const;
export const MAX_METRO_KM = 250;

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
  teri: "https://www.teriin.org/files/TERI-Annual-Report-2023-24.pdf#page=60",
  dmrc: "https://delhimetrorail.com/carbonlite-metro-travel",
} as const;

export function tripTimes({ walking, waiting, outdoorWaiting, riding }: Trip) {
  return {
    total: walking === null || waiting === null || riding === null ? null : walking + waiting + riding,
    outdoors: walking === null || (outdoorWaiting === null && waiting !== 0) ? null : walking + (outdoorWaiting ?? 0),
  };
}

export function metroSavings({ current, alternative, averageRoadBaseline, metroKm }: TravelComparison) {
  if (current.mode !== "road" || alternative.mode !== "metro" || !averageRoadBaseline ||
    metroKm === null || metroKm <= 0 || metroKm > MAX_METRO_KM) return null;
  return metroMethods.map((method) => ({
    ...method,
    kg: metroKm * (method.gramsPerKm / 1000),
  }));
}

export function passengerGrams(factor: string, distance: string, occupants: string) {
  if (!factor.trim() || !distance.trim() || !occupants.trim()) return null;
  const [gramsPerKm, km, riders] = [factor, distance, occupants].map(Number);
  if (gramsPerKm < 0 || gramsPerKm > 10000 || km < 0 || km > 1000 ||
    !Number.isFinite(gramsPerKm) || !Number.isFinite(km) ||
    !Number.isInteger(riders) || riders < 1 || riders > 200) return null;
  return gramsPerKm * km / riders;
}
