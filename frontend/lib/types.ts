export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "UPSTREAM_ERROR"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
};

export type RouteLocationBias = {
  latitude: number;
  longitude: number;
};

export type TripParseResult = {
  stops: string[];
  deadline?: string;
  notes?: string[];
};

export type ResolvedRouteStop = {
  input: string;
  label: string;
  address?: string;
  location?: RouteLocationBias;
  isHome?: boolean;
};

export type RoutePlan = {
  orderedStops: string[];
  totalDurationText: string;
  arrivalEstimate?: string;
  originLabel?: string;
};

export type RoutePlanResponse = {
  parsed: TripParseResult;
  route: RoutePlan;
  meta: {
    provider: "google-routes";
    model: string;
  };
};

export type PlanRouteRequest = {
  prompt: string;
  homeAddress?: string;
  locationBias?: RouteLocationBias;
};
