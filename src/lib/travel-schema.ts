import { z } from "zod";
import { trafficLevels, travelModes, vehicleTypes } from "./travel";

const minutes = z.number().int().min(0).max(1440).nullable();

const tripSchema = z.strictObject({
  mode: z.enum(travelModes).nullable(),
  vehicle: z.enum(vehicleTypes).nullable(),
  traffic: z.enum(trafficLevels).nullable(),
  walking: minutes,
  waiting: minutes,
  outdoorWaiting: minutes,
  riding: minutes,
}).refine(({ outdoorWaiting, waiting }) => outdoorWaiting === null || waiting === null || outdoorWaiting <= waiting, {
  path: ["outdoorWaiting"],
  message: "Outdoor waiting must fit within all waiting time.",
});

export const travelComparisonSchema = z.strictObject({
  current: tripSchema,
  alternative: tripSchema,
  averageRoadBaseline: z.boolean(),
  metroKm: z.number().positive("Enter a distance greater than zero.").nullable(),
});
