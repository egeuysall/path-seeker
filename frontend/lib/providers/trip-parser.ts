import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import { getAiGatewayConfig } from "@/lib/env";
import { ApiRouteError } from "@/lib/api-response";
import { tripParseResultSchema } from "@/lib/schemas/trip";
import type { TripParseResult } from "@/lib/types";

const aiTripSchema = z.object({
  stops: z.array(z.string()).describe("Destination names in likely visit order."),
  deadline: z.string().nullable().describe("Time constraint phrase if present, otherwise null."),
  notes: z.array(z.string()).describe("Short caveats, such as uncertainty in place names."),
});

type AiTripResult = z.infer<typeof aiTripSchema>;

export function normalizeTripDetails(input: AiTripResult): TripParseResult {
  const deadline = input.deadline?.trim();
  const notes = input.notes
    .map((note) => note.trim())
    .filter((note) => note.length > 0);

  return {
    stops: input.stops,
    ...(deadline ? { deadline } : {}),
    ...(notes.length > 0 ? { notes } : {}),
  };
}

export async function extractTripDetails(prompt: string): Promise<TripParseResult> {
  const gateway = getAiGatewayConfig();
  const openai = createOpenAI({
    apiKey: gateway.apiKey,
    baseURL: gateway.baseURL,
  });

  const result = await generateObject({
    model: openai(gateway.model),
    schema: aiTripSchema,
    prompt: [
      "Extract structured trip details from user text.",
      "Return only places to visit and optional time constraints.",
      "Always return every schema field.",
      "Use null for deadline when there is no time constraint.",
      "Use an empty array for notes when there are no caveats.",
      "If home appears in the request, keep it as a stop.",
      "Do not invent stops that are not implied by the user.",
      `User request: ${prompt}`,
    ].join("\n"),
  });

  const parsed = tripParseResultSchema.safeParse(normalizeTripDetails(result.object));

  if (!parsed.success) {
    throw new ApiRouteError(400, "VALIDATION_ERROR", "Could not parse enough destinations.");
  }

  return parsed.data;
}
