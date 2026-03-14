import { RoutesClient } from "@googlemaps/routing";

import { ApiRouteError } from "@/lib/api-response";
import { getGoogleMapsApiKey } from "@/lib/env";
import { addDurationToNowIso, formatDurationSeconds } from "@/lib/utils";
import type { ResolvedRouteStop, RoutePlan } from "@/lib/types";

type DurationLike =
  | string
  | {
      seconds?: number | string | bigint | { toString(): string } | null;
      nanos?: number | null;
    }
  | null;

type GoogleRoute = {
  duration?: DurationLike;
  optimizedIntermediateWaypointIndex?: number[] | null;
};

type GoogleErrorShape = {
  details?: string;
  message?: string;
};

type GoogleApiErrorPayload = {
  error?: {
    message?: string;
    details?: Array<{
      reason?: string;
      metadata?: {
        service?: string;
      };
    }>;
  };
};

type ComputeOptimizedRouteOptions = {
  origin?: ResolvedRouteStop;
};

type RouteCandidate = {
  plan: RoutePlan;
  totalSeconds: number;
};

let routesClient: RoutesClient | undefined;

function getRoutesClient() {
  routesClient ??= new RoutesClient({
    apiKey: getGoogleMapsApiKey(),
    fallback: true,
  });

  return routesClient;
}

function parseWholeSeconds(value?: number | string | bigint | { toString(): string } | null) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseGoogleDurationToSeconds(duration?: DurationLike): number {
  if (!duration) {
    return 0;
  }

  if (typeof duration === "string") {
    const match = duration.match(/^(\d+)(?:\.\d+)?s$/);

    if (!match) {
      return 0;
    }

    return Number(match[1]);
  }

  const seconds = parseWholeSeconds(duration.seconds);
  const nanos = typeof duration.nanos === "number" ? duration.nanos : 0;

  return Math.max(0, seconds + Math.floor(nanos / 1_000_000_000));
}

export function normalizeRouteResult(
  origin: ResolvedRouteStop,
  intermediates: ResolvedRouteStop[],
  destination: ResolvedRouteStop,
  route: GoogleRoute,
  options?: { includeOriginInOrderedStops?: boolean },
): RouteCandidate {
  const waypointOrder = route.optimizedIntermediateWaypointIndex ?? intermediates.map((_, index) => index);
  const hasInvalidWaypointOrder = waypointOrder.some((index) => index < 0 || index >= intermediates.length);

  const orderedIntermediates =
    intermediates.length === 0
      ? []
      : hasInvalidWaypointOrder
        ? intermediates
        : waypointOrder.map((index) => intermediates[index]);

  const totalSeconds = parseGoogleDurationToSeconds(route.duration);
  const orderedStops = [
    ...(options?.includeOriginInOrderedStops ? [origin.label] : []),
    ...orderedIntermediates.map((stop) => stop.label),
    destination.label,
  ];

  return {
    totalSeconds,
    plan: {
      orderedStops,
      totalDurationText: formatDurationSeconds(totalSeconds),
      arrivalEstimate: totalSeconds > 0 ? addDurationToNowIso(totalSeconds) : undefined,
      ...(options?.includeOriginInOrderedStops ? {} : { originLabel: origin.label }),
    },
  };
}

function buildWaypoint(stop: ResolvedRouteStop) {
  if (stop.location) {
    return {
      location: {
        latLng: {
          latitude: stop.location.latitude,
          longitude: stop.location.longitude,
        },
      },
    };
  }

  return {
    address: stop.address ?? stop.label,
  };
}

function extractGoogleErrorMessage(error: GoogleErrorShape) {
  const detail = error.details ?? error.message;

  if (detail) {
    try {
      const payload = JSON.parse(detail) as GoogleApiErrorPayload;
      const reason = payload.error?.details?.find((item) => item.reason)?.reason;

      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
        return "GOOGLE_MAPS_API_KEY is restricted to browser referrers. Use a server-side key or adjust the key restrictions for Routes API.";
      }

      if (payload.error?.message) {
        return payload.error.message;
      }
    } catch {
      if (error.details) {
        return detail;
      }
    }
  }

  return error.message ?? "Google Routes API request failed.";
}

async function requestRouteCandidate(
  origin: ResolvedRouteStop,
  destination: ResolvedRouteStop,
  intermediates: ResolvedRouteStop[],
  options?: { includeOriginInOrderedStops?: boolean },
) {
  const responseTuple = (await getRoutesClient().computeRoutes(
    {
      origin: buildWaypoint(origin),
      destination: buildWaypoint(destination),
      intermediates: intermediates.map(buildWaypoint),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      optimizeWaypointOrder: true,
    },
    {
      otherArgs: {
        headers: {
          "X-Goog-FieldMask": "routes.duration,routes.optimizedIntermediateWaypointIndex",
        },
      },
    },
  )) as unknown as [{ routes?: GoogleRoute[] }];

  const [response] = responseTuple;
  const route = response.routes?.[0];

  if (!route) {
    throw new ApiRouteError(502, "UPSTREAM_ERROR", "Google Routes API returned no routes.");
  }

  return normalizeRouteResult(origin, intermediates, destination, route, options);
}

function getDestinationCandidates(stops: ResolvedRouteStop[]) {
  const homeStop = stops.find((stop) => stop.isHome);
  return homeStop ? [homeStop] : stops;
}

export async function computeOptimizedRoute(
  stops: ResolvedRouteStop[],
  options?: ComputeOptimizedRouteOptions,
): Promise<RoutePlan> {
  if (stops.length < 2) {
    throw new ApiRouteError(400, "VALIDATION_ERROR", "At least two stops are required.");
  }

  try {
    if (options?.origin) {
      const candidates = await Promise.all(
        getDestinationCandidates(stops).map((destination) =>
          requestRouteCandidate(
            options.origin as ResolvedRouteStop,
            destination,
            stops.filter((stop) => stop !== destination),
          ),
        ),
      );

      return candidates.reduce((best, candidate) =>
        candidate.totalSeconds < best.totalSeconds ? candidate : best,
      ).plan;
    }

    return (
      await requestRouteCandidate(stops[0], stops[stops.length - 1], stops.slice(1, -1), {
        includeOriginInOrderedStops: true,
      })
    ).plan;
  } catch (error) {
    if (error instanceof ApiRouteError) {
      throw error;
    }

    const message =
      error && typeof error === "object"
        ? extractGoogleErrorMessage(error as GoogleErrorShape)
        : "Google Routes API request failed.";

    throw new ApiRouteError(502, "UPSTREAM_ERROR", message);
  }
}
