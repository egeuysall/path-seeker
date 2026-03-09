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

export type TripParseResult = {
  stops: string[];
  deadline?: string;
  notes?: string[];
};

export type RoutePlan = {
  orderedStops: string[];
  totalDurationText: string;
  arrivalEstimate?: string;
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
};
