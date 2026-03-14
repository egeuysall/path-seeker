import { Client } from "@googlemaps/google-maps-services-js";

import { ApiRouteError } from "@/lib/api-response";
import { getGoogleMapsApiKey } from "@/lib/env";
import type { RouteLocationBias } from "@/lib/types";

let geocodingClient: Client | undefined;

function getGeocodingClient() {
  geocodingClient ??= new Client();
  return geocodingClient;
}

export async function reverseGeocodeLocation(location: RouteLocationBias) {
  try {
    const response = await getGeocodingClient().reverseGeocode({
      params: {
        key: getGoogleMapsApiKey(),
        latlng: {
          lat: location.latitude,
          lng: location.longitude,
        },
      },
    });

    const address = response.data.results[0]?.formatted_address?.trim();

    if (!address) {
      throw new ApiRouteError(502, "UPSTREAM_ERROR", "Could not resolve the current location to an address.");
    }

    return address;
  } catch (error) {
    if (error instanceof ApiRouteError) {
      throw error;
    }

    throw new ApiRouteError(502, "UPSTREAM_ERROR", "Could not resolve the current location to an address.");
  }
}
