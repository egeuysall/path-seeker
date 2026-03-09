import { describe, expect, it } from "vitest";

import { normalizeRouteResult } from "@/lib/providers/google-routes";

describe("normalizeRouteResult", () => {
  it("applies optimized intermediate waypoint order", () => {
    const stops = ["Home", "Target", "UPS", "Bank"];

    const result = normalizeRouteResult(stops, {
      duration: "3600s",
      optimizedIntermediateWaypointIndex: [1, 0],
    });

    expect(result.orderedStops).toEqual(["Home", "UPS", "Target", "Bank"]);
    expect(result.totalDurationText).toBe("1 hr");
    expect(result.arrivalEstimate).toBeDefined();
  });

  it("handles routes without intermediate stops", () => {
    const stops = ["Home", "Office"];

    const result = normalizeRouteResult(stops, {
      duration: "900s",
    });

    expect(result.orderedStops).toEqual(["Home", "Office"]);
    expect(result.totalDurationText).toBe("15 min");
  });
});
