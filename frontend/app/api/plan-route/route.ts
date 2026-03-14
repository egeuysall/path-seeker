import { NextResponse } from "next/server";

import { ApiRouteError, handleRouteError } from "@/lib/api-response";
import { getAiGatewayConfig } from "@/lib/env";
import { computeOptimizedRoute } from "@/lib/providers/google-routes";
import { resolveRouteStops } from "@/lib/providers/stop-resolver";
import { extractTripDetails } from "@/lib/providers/trip-parser";
import { planRouteRequestSchema } from "@/lib/schemas/trip";
import type { RoutePlanResponse } from "@/lib/types";

export async function handlePlanRouteRequest(input: unknown) {
  const parsedRequest = planRouteRequestSchema.safeParse(input);

  if (!parsedRequest.success) {
    throw new ApiRouteError(400, "BAD_REQUEST", "A valid prompt is required.");
  }

  const parsed = await extractTripDetails(parsedRequest.data.prompt);

  if (parsed.stops.length < 2) {
    throw new ApiRouteError(400, "VALIDATION_ERROR", "At least two stops are required.");
  }

  const resolved = await resolveRouteStops(parsed.stops, {
    homeAddress: parsedRequest.data.homeAddress,
    locationBias: parsedRequest.data.locationBias,
  });

  const route = await computeOptimizedRoute(resolved.stops, {
    ...(parsedRequest.data.locationBias
      ? {
          origin: {
            input: "current-location",
            label: "Current location",
            location: parsedRequest.data.locationBias,
          },
        }
      : {}),
  });
  const config = getAiGatewayConfig();
  const notes = [...(parsed.notes ?? []), ...resolved.notes];

  const response: RoutePlanResponse = {
    parsed: {
      ...parsed,
      ...(notes.length > 0 ? { notes } : {}),
    },
    route,
    meta: {
      provider: "google-routes",
      model: config.model,
    },
  };

  return response;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await handlePlanRouteRequest(body);

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
