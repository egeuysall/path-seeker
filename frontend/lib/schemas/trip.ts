import { z } from "zod";

export const locationBiasSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const planRouteRequestSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required."),
  homeAddress: z.string().trim().min(1).optional(),
  locationBias: locationBiasSchema.optional(),
});

export const tripParseResultSchema = z.object({
  stops: z.array(z.string().trim().min(1)).min(2, "At least two stops are required."),
  deadline: z.string().trim().min(1).optional(),
  notes: z.array(z.string().trim().min(1)).optional(),
});

export type TripParseResultInput = z.infer<typeof tripParseResultSchema>;
