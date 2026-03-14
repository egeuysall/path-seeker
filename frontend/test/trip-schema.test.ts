import { describe, expect, it } from "vitest";

import { tripParseResultSchema } from "@/lib/schemas/trip";

describe("tripParseResultSchema", () => {
  it("accepts valid payload", () => {
    const payload = {
      stops: ["Target", "UPS", "Home"],
      deadline: "before 6 PM",
      notes: ["Traffic may vary"],
    };

    const result = tripParseResultSchema.safeParse(payload);

    expect(result.success).toBe(true);
  });

  it("rejects payload with fewer than two stops", () => {
    const payload = {
      stops: ["Target"],
    };

    const result = tripParseResultSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });

  it("rejects empty stop strings", () => {
    const payload = {
      stops: ["Target", ""],
    };

    const result = tripParseResultSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });
});
