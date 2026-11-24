export const cityPresets = {
  delhi: ["Delhi", 28.61, 77.21],
  gurugram: ["Gurugram", 28.46, 77.03],
  noida: ["Noida", 28.54, 77.39],
  ghaziabad: ["Ghaziabad", 28.67, 77.45],
  faridabad: ["Faridabad", 28.41, 77.32],
  lucknow: ["Lucknow", 26.85, 80.95],
  patna: ["Patna", 25.61, 85.14],
  kolkata: ["Kolkata", 22.57, 88.36],
  mumbai: ["Mumbai", 19.08, 72.88],
  bengaluru: ["Bengaluru", 12.97, 77.59],
} as const;

export const estimateSource = {
  label: "CAMS global model via Open-Meteo",
  url: "https://open-meteo.com/en/docs/air-quality-api",
};

export function cityPreset(key: string | null) {
  return key && Object.hasOwn(cityPresets, key) ? cityPresets[key as keyof typeof cityPresets] : null;
}
