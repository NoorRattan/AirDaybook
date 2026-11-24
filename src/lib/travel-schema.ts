import { z } from "zod/v4-mini";
import { trafficLevels, travelModes, vehicleTypes } from "./travel";

const minutes = z.nullable(z.number().check(z.int(), z.minimum(0), z.maximum(1440)));

const tripSchema = z.strictObject({
  mode: z.nullable(z.enum(travelModes)),
  vehicle: z.nullable(z.enum(vehicleTypes)),
  traffic: z.nullable(z.enum(trafficLevels)),
  walking: minutes,
  waiting: minutes,
  outdoorWaiting: minutes,
  riding: minutes,
}).check(z.refine(({ outdoorWaiting, waiting }) => outdoorWaiting === null || waiting === null || outdoorWaiting <= waiting, {
  path: ["outdoorWaiting"],
  message: "Outdoor waiting must fit within all waiting time.",
}));

export const travelComparisonSchema = z.strictObject({
  current: tripSchema,
  alternative: tripSchema,
  averageRoadBaseline: z.boolean(),
  metroKm: z.nullable(z.number().check(z.positive("Enter a distance greater than zero."))),
});
