import { PlacesClient } from "@googlemaps/places";

import { ApiRouteError } from "@/lib/api-response";
import { getGoogleMapsApiKey } from "@/lib/env";
import type { ResolvedRouteStop, RouteLocationBias } from "@/lib/types";

type PlaceResult = {
  displayName?: {
    text?: string | null;
  } | null;
  formattedAddress?: string | null;
  location?: {
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

type StopResolutionContext = {
  homeAddress?: string;
  locationBias?: RouteLocationBias;
};

type StopResolutionResult = {
  notes: string[];
  stops: ResolvedRouteStop[];
};

const stopAliasMap = new Map<string, string>([["ups", "UPS Store"]]);

let placesClient: PlacesClient | undefined;

function getPlacesClient() {
  placesClient ??= new PlacesClient({
    apiKey: getGoogleMapsApiKey(),
    fallback: true,
  });

  return placesClient;
}

function normalizeStopName(stop: string) {
  return stop.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "");
}

function isHomeAlias(stop: string) {
  const normalized = normalizeStopName(stop);
  return normalized === "home" || normalized === "my home" || normalized === "house" || normalized === "my house";
}

function buildSearchQuery(stop: string) {
  const normalized = normalizeStopName(stop);
  return stopAliasMap.get(normalized) ?? stop.trim();
}

function getLocationBias(locationBias?: RouteLocationBias) {
  if (!locationBias) {
    return undefined;
  }

  return {
    circle: {
      center: {
        latitude: locationBias.latitude,
        longitude: locationBias.longitude,
      },
      radius: 20_000,
    },
  };
}

function formatResolvedLabel(input: string, place: PlaceResult) {
  if (isHomeAlias(input)) {
    return "Home";
  }

  const displayName = place.displayName?.text?.trim();
  const formattedAddress = place.formattedAddress?.trim();

  if (displayName && formattedAddress) {
    return `${displayName}, ${formattedAddress}`;
  }

  return formattedAddress || displayName || input;
}

function toLocationBias(place?: PlaceResult | null): RouteLocationBias | undefined {
  const latitude = place?.location?.latitude;
  const longitude = place?.location?.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return undefined;
  }

  return { latitude, longitude };
}

async function searchPlace(textQuery: string, locationBias?: RouteLocationBias) {
  const [response] = await getPlacesClient().searchText(
    {
      textQuery,
      maxResultCount: 1,
      rankPreference: locationBias ? "DISTANCE" : "RELEVANCE",
      ...(locationBias ? { locationBias: getLocationBias(locationBias) } : {}),
    },
    {
      otherArgs: {
        headers: {
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
        },
      },
    },
  );

  return response.places?.[0] as PlaceResult | undefined;
}

async function resolveHomeContext(homeAddress: string) {
  const place = await searchPlace(homeAddress);

  return {
    bias: toLocationBias(place),
    stop: {
      input: "home",
      label: "Home",
      address: place?.formattedAddress?.trim() || homeAddress,
      isHome: true,
      ...(toLocationBias(place) ? { location: toLocationBias(place) } : {}),
    } satisfies ResolvedRouteStop,
  };
}

function buildHomeFromCurrentLocation(locationBias: RouteLocationBias): ResolvedRouteStop {
  return {
    input: "home",
    label: "Home",
    isHome: true,
    location: locationBias,
  };
}

export async function resolveRouteStops(
  stops: string[],
  context: StopResolutionContext,
): Promise<StopResolutionResult> {
  const notes: string[] = [];
  const resolvedStops: ResolvedRouteStop[] = [];

  let effectiveLocationBias = context.locationBias;
  let resolvedHomeStop: ResolvedRouteStop | undefined;

  if (context.homeAddress) {
    const homeContext = await resolveHomeContext(context.homeAddress);
    effectiveLocationBias ??= homeContext.bias;
    resolvedHomeStop = homeContext.stop;
  }

  for (const stop of stops) {
    if (isHomeAlias(stop)) {
      if (resolvedHomeStop) {
        resolvedStops.push({ ...resolvedHomeStop, input: stop });
        continue;
      }

      if (context.locationBias) {
        resolvedStops.push({ ...buildHomeFromCurrentLocation(context.locationBias), input: stop });
        notes.push("Used your current location for home.");
        continue;
      }

      throw new ApiRouteError(
        400,
        "VALIDATION_ERROR",
        'Add your home address or allow location access when the trip includes "home".',
      );
    }

    const place = await searchPlace(buildSearchQuery(stop), effectiveLocationBias);

    if (!place?.formattedAddress) {
      throw new ApiRouteError(
        400,
        "VALIDATION_ERROR",
        `Couldn't identify a precise location for "${stop}". Add a city, neighborhood, or street address.`,
      );
    }

    resolvedStops.push({
      input: stop,
      label: formatResolvedLabel(stop, place),
      address: place.formattedAddress.trim(),
      ...(toLocationBias(place) ? { location: toLocationBias(place) } : {}),
    });
  }

  return {
    notes,
    stops: resolvedStops,
  };
}
