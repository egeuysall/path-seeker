import { describe, expect, it } from "vitest";

import { normalizeRouteResult } from "@/lib/providers/google-routes";

describe("normalizeRouteResult", () => {
  it("applies optimized intermediate waypoint order", () => {
    const result = normalizeRouteResult(
      { input: "Home", label: "Home" },
      [
        { input: "Target", label: "Target" },
        { input: "UPS", label: "UPS" },
      ],
      { input: "Bank", label: "Bank" },
      {
        duration: "3600s",
        optimizedIntermediateWaypointIndex: [1, 0],
      },
      {
        includeOriginInOrderedStops: true,
      },
    ).plan;

    expect(result.orderedStops).toEqual(["Home", "UPS", "Target", "Bank"]);
    expect(result.totalDurationText).toBe("1 hr");
    expect(result.arrivalEstimate).toBeDefined();
  });

  it("tracks the route origin separately when provided", () => {
    const result = normalizeRouteResult(
      { input: "current-location", label: "Current location" },
      [{ input: "Target", label: "Target" }],
      { input: "Home", label: "Home", isHome: true },
      {
        duration: "1800s",
      },
    ).plan;

    expect(result.originLabel).toBe("Current location");
    expect(result.orderedStops).toEqual(["Target", "Home"]);
  });

  it("handles routes without intermediate stops", () => {
    const result = normalizeRouteResult(
      { input: "Home", label: "Home" },
      [],
      { input: "Office", label: "Office" },
      {
        duration: "900s",
      },
      {
        includeOriginInOrderedStops: true,
      },
    ).plan;

    expect(result.orderedStops).toEqual(["Home", "Office"]);
    expect(result.totalDurationText).toBe("15 min");
  });

  it("falls back to the original intermediate order when Google returns invalid indexes", () => {
    const result = normalizeRouteResult(
      { input: "Home", label: "Home" },
      [
        { input: "Target", label: "Target" },
        { input: "UPS", label: "UPS" },
      ],
      { input: "Bank", label: "Bank" },
      {
        duration: "1800s",
        optimizedIntermediateWaypointIndex: [1, 2],
      },
      {
        includeOriginInOrderedStops: true,
      },
    ).plan;

    expect(result.orderedStops).toEqual(["Home", "Target", "UPS", "Bank"]);
  });
});
