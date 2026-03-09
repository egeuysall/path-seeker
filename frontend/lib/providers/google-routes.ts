import { ApiRouteError } from "@/lib/api-response";
import { getGoogleMapsApiKey } from "@/lib/env";
import { addDurationToNowIso, formatDurationSeconds } from "@/lib/utils";
import type { RoutePlan } from "@/lib/types";

type GoogleRoute = {
  duration?: string;
  optimizedIntermediateWaypointIndex?: number[];
};

type GoogleRoutesResponse = {
  routes?: GoogleRoute[];
  error?: {
    message?: string;
  };
};

function parseGoogleDurationToSeconds(duration?: string): number {
  if (!duration) {
    return 0;
  }

  const match = duration.match(/^(\d+)s$/);

  if (!match) {
    return 0;
  }

  return Number(match[1]);
}

export function normalizeRouteResult(stops: string[], route: GoogleRoute): RoutePlan {
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const intermediates = stops.slice(1, -1);

  const orderedIntermediates =
    intermediates.length === 0
      ? []
      : (route.optimizedIntermediateWaypointIndex ?? intermediates.map((_, index) => index)).map(
          (index) => intermediates[index],
        );

  const orderedStops = [origin, ...orderedIntermediates, destination];
  const totalSeconds = parseGoogleDurationToSeconds(route.duration);

  return {
    orderedStops,
    totalDurationText: formatDurationSeconds(totalSeconds),
    arrivalEstimate: totalSeconds > 0 ? addDurationToNowIso(totalSeconds) : undefined,
  };
}

export async function computeOptimizedRoute(stops: string[]): Promise<RoutePlan> {
  if (stops.length < 2) {
    throw new ApiRouteError(400, "VALIDATION_ERROR", "At least two stops are required.");
  }

  const apiKey = getGoogleMapsApiKey();
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  const intermediates = stops.slice(1, -1).map((address) => ({ address }));

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      intermediates,
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      optimizeWaypointOrder: true,
    }),
  });

  const payload = (await response.json()) as GoogleRoutesResponse;

  if (!response.ok) {
    const message = payload.error?.message ?? "Google Routes API request failed.";
    throw new ApiRouteError(502, "UPSTREAM_ERROR", message);
  }

  const route = payload.routes?.[0];

  if (!route) {
    throw new ApiRouteError(502, "UPSTREAM_ERROR", "Google Routes API returned no routes.");
  }

  return normalizeRouteResult(stops, route);
}
