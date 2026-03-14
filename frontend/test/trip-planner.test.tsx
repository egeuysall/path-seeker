import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TripPlanner } from "@/components/trip-planner";

type MediaRecorderEvent = Event | { data: Blob };

class MediaRecorderMock {
  private listeners: Record<string, Array<(event?: MediaRecorderEvent) => void>> = {};
  public mimeType = "audio/webm";

  constructor(private readonly _stream: MediaStream) {}

  addEventListener(name: string, callback: (event?: MediaRecorderEvent) => void) {
    this.listeners[name] = this.listeners[name] ?? [];
    this.listeners[name].push(callback);
  }

  start() {
    return;
  }

  stop() {
    const dataHandlers = this.listeners.dataavailable ?? [];
    const stopHandlers = this.listeners.stop ?? [];

    dataHandlers.forEach((callback) => callback({ data: new Blob(["audio"], { type: "audio/webm" }) }));
    stopHandlers.forEach((callback) => callback());
  }
}

describe("TripPlanner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("submits text prompt and renders route results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        parsed: {
          stops: ["Target", "UPS", "Home"],
          deadline: "before 6 PM",
        },
        route: {
          orderedStops: ["Target", "UPS", "Home"],
          totalDurationText: "32 min",
          arrivalEstimate: new Date().toISOString(),
          originLabel: "Current location",
        },
        meta: {
          provider: "google-routes",
          model: "openai/gpt-4.1-mini",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Request"), "I need to go to Target and UPS then home");
    await user.click(screen.getByRole("button", { name: "Plan Route" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/plan-route",
      expect.objectContaining({
        method: "POST",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Route Result")).toBeInTheDocument();
      expect(screen.getByText("Starting From: Current location")).toBeInTheDocument();
      expect(screen.getAllByText("Target")).toHaveLength(2);
      expect(screen.getByText("32 min")).toBeInTheDocument();
    });
  });

  it("records voice and fills transcript", async () => {
    const track = { stop: vi.fn() };
    const stream = {
      getTracks: () => [track],
    } as unknown as MediaStream;

    vi.stubGlobal("MediaRecorder", MediaRecorderMock as unknown as typeof MediaRecorder);

    Object.defineProperty(global.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: "Go to Target then Home" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Record Voice" }));
    await user.click(screen.getByRole("button", { name: "Stop Recording" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Request")).toHaveValue("Go to Target then Home");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transcribe",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("renders API errors from route planning", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: {
          code: "UPSTREAM_ERROR",
          message: "Google Routes API request failed.",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Request"), "Target then Home");
    await user.click(screen.getByRole("button", { name: "Plan Route" }));

    await waitFor(() => {
      expect(screen.getByText("Google Routes API request failed.")).toBeInTheDocument();
    });
  });

  it("fills home address from current location", async () => {
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (success: (position: GeolocationPosition) => void) => {
          success({
            coords: {
              latitude: 42.0451,
              longitude: -87.6877,
            },
          } as GeolocationPosition);
        },
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: "123 Main St, Evanston, IL 60201" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<TripPlanner />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Use Current Location" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Home Address")).toHaveValue("123 Main St, Evanston, IL 60201");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reverse-geocode",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
