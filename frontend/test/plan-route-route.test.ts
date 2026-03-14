import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/trip-parser", () => ({
  extractTripDetails: vi.fn(),
}));

vi.mock("@/lib/providers/google-routes", () => ({
  computeOptimizedRoute: vi.fn(),
}));

vi.mock("@/lib/providers/stop-resolver", () => ({
  resolveRouteStops: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getAiGatewayConfig: vi.fn(() => ({
    model: "openai/gpt-4.1-mini",
    apiKey: "test",
    baseURL: "https://ai-gateway.vercel.sh/v1",
  })),
}));

import { handlePlanRouteRequest } from "@/app/api/plan-route/route";
import { computeOptimizedRoute } from "@/lib/providers/google-routes";
import { resolveRouteStops } from "@/lib/providers/stop-resolver";
import { extractTripDetails } from "@/lib/providers/trip-parser";

const mockedExtractTripDetails = vi.mocked(extractTripDetails);
const mockedComputeOptimizedRoute = vi.mocked(computeOptimizedRoute);
const mockedResolveRouteStops = vi.mocked(resolveRouteStops);

describe("handlePlanRouteRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns normalized response on success", async () => {
    mockedExtractTripDetails.mockResolvedValue({
      stops: ["Target", "UPS", "Home"],
      deadline: "before 6 PM",
      notes: [],
    });

    mockedResolveRouteStops.mockResolvedValue({
      notes: ["Used your current location for home."],
      stops: [
        { input: "Target", label: "Target, Evanston, IL", address: "Target, Evanston, IL" },
        { input: "UPS", label: "UPS Store, Evanston, IL", address: "UPS Store, Evanston, IL" },
        { input: "Home", label: "Home", address: "123 Main St, Evanston, IL" },
      ],
    });

    mockedComputeOptimizedRoute.mockResolvedValue({
      orderedStops: ["Target, Evanston, IL", "UPS Store, Evanston, IL", "Home"],
      totalDurationText: "25 min",
      arrivalEstimate: new Date().toISOString(),
      originLabel: "Current location",
    });

    const result = await handlePlanRouteRequest({
      prompt: "Target then UPS then home before 6",
      locationBias: {
        latitude: 42.0451,
        longitude: -87.6877,
      },
    });

    expect(result.parsed.stops).toEqual(["Target", "UPS", "Home"]);
    expect(result.parsed.notes).toContain("Used your current location for home.");
    expect(result.meta.provider).toBe("google-routes");
    expect(mockedComputeOptimizedRoute).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        origin: expect.objectContaining({
          label: "Current location",
        }),
      }),
    );
  });

  it("throws when prompt is invalid", async () => {
    await expect(handlePlanRouteRequest({ prompt: "" })).rejects.toThrow("A valid prompt is required.");
  });

  it("throws when extracted stops are insufficient", async () => {
    mockedExtractTripDetails.mockResolvedValue({
      stops: ["Target"],
      notes: [],
    });

    await expect(handlePlanRouteRequest({ prompt: "Target" })).rejects.toThrow("At least two stops are required.");
  });

  it("propagates provider errors", async () => {
    mockedExtractTripDetails.mockResolvedValue({
      stops: ["Target", "Home"],
      notes: [],
    });

    mockedResolveRouteStops.mockResolvedValue({
      notes: [],
      stops: [
        { input: "Target", label: "Target, Evanston, IL", address: "Target, Evanston, IL" },
        { input: "Home", label: "Home", address: "123 Main St, Evanston, IL" },
      ],
    });

    mockedComputeOptimizedRoute.mockRejectedValue(new Error("Google failed"));

    await expect(handlePlanRouteRequest({ prompt: "Target then home" })).rejects.toThrow("Google failed");
  });
});
