import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/trip-parser", () => ({
  extractTripDetails: vi.fn(),
}));

vi.mock("@/lib/providers/google-routes", () => ({
  computeOptimizedRoute: vi.fn(),
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
import { extractTripDetails } from "@/lib/providers/trip-parser";

const mockedExtractTripDetails = vi.mocked(extractTripDetails);
const mockedComputeOptimizedRoute = vi.mocked(computeOptimizedRoute);

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

    mockedComputeOptimizedRoute.mockResolvedValue({
      orderedStops: ["Target", "UPS", "Home"],
      totalDurationText: "25 min",
      arrivalEstimate: new Date().toISOString(),
    });

    const result = await handlePlanRouteRequest({
      prompt: "Target then UPS then home before 6",
    });

    expect(result.parsed.stops).toEqual(["Target", "UPS", "Home"]);
    expect(result.meta.provider).toBe("google-routes");
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

    mockedComputeOptimizedRoute.mockRejectedValue(new Error("Google failed"));

    await expect(handlePlanRouteRequest({ prompt: "Target then home" })).rejects.toThrow("Google failed");
  });
});
