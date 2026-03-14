import { describe, expect, it } from "vitest";

import { normalizeTripDetails } from "@/lib/providers/trip-parser";

describe("normalizeTripDetails", () => {
  it("drops empty optional fields returned by the model", () => {
    const result = normalizeTripDetails({
      stops: ["Target", "Home"],
      deadline: null,
      notes: [],
    });

    expect(result).toEqual({
      stops: ["Target", "Home"],
    });
  });

  it("trims and preserves populated optional fields", () => {
    const result = normalizeTripDetails({
      stops: ["Target", "UPS", "Home"],
      deadline: " before 6 PM ",
      notes: ["  verify store hours  ", " "],
    });

    expect(result).toEqual({
      stops: ["Target", "UPS", "Home"],
      deadline: "before 6 PM",
      notes: ["verify store hours"],
    });
  });
});
