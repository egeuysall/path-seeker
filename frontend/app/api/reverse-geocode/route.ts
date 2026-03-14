import { NextResponse } from "next/server";

import { ApiRouteError, handleRouteError } from "@/lib/api-response";
import { reverseGeocodeLocation } from "@/lib/providers/geocoding";
import { locationBiasSchema } from "@/lib/schemas/trip";

export async function handleReverseGeocodeRequest(input: unknown) {
  const parsed = locationBiasSchema.safeParse(input);

  if (!parsed.success) {
    throw new ApiRouteError(400, "BAD_REQUEST", "A valid location is required.");
  }

  const address = await reverseGeocodeLocation(parsed.data);
  return { address };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = await handleReverseGeocodeRequest(body);

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
