"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RouteLocationBias, RoutePlanResponse } from "@/lib/types";

type ApiFailure = {
  error?: {
    message?: string;
  };
};

type ReverseGeocodeResponse = {
  address?: string;
};

const homeAddressStorageKey = "pathseeker.home-address";

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  const storage = window.localStorage;

  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null;
  }

  return storage;
}

function formatArrivalTime(isoValue?: string) {
  if (!isoValue) {
    return undefined;
  }

  const date = new Date(isoValue);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function extractApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidate = payload as ApiFailure;
  return candidate.error?.message ?? fallback;
}

export function TripPlanner() {
  const [homeAddress, setHomeAddress] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<RoutePlanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] =
    useState<RouteLocationBias | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const arrivalTime = useMemo(
    () => formatArrivalTime(result?.route.arrivalEstimate),
    [result],
  );

  useEffect(() => {
    const storage = getBrowserStorage();

    if (!storage) {
      return;
    }

    const stored = storage.getItem(homeAddressStorageKey);

    if (stored) {
      setHomeAddress(stored);
    }
  }, []);

  useEffect(() => {
    const storage = getBrowserStorage();

    if (!storage) {
      return;
    }

    if (homeAddress.trim().length === 0) {
      storage.removeItem(homeAddressStorageKey);
      return;
    }

    storage.setItem(homeAddressStorageKey, homeAddress.trim());
  }, [homeAddress]);

  function requestCurrentLocation() {
    if (!navigator.geolocation) {
      return Promise.resolve<RouteLocationBias | null>(null);
    }

    setIsLocating(true);

    return new Promise<RouteLocationBias | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          setCurrentLocation(nextLocation);

          try {
            const response = await fetch("/api/reverse-geocode", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(nextLocation),
            });

            const payload = (await response.json()) as
              | ReverseGeocodeResponse
              | ApiFailure;

            if (!response.ok) {
              throw new Error(
                extractApiError(
                  payload,
                  "Could not resolve your current location.",
                ),
              );
            }

            if (
              "address" in payload &&
              typeof payload.address === "string" &&
              payload.address.length > 0
            ) {
              setHomeAddress(payload.address);
            }
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Could not resolve your current location.";
            setErrorMessage(message);
          } finally {
            setIsLocating(false);
            resolve(nextLocation);
          }
        },
        () => {
          setIsLocating(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 300000,
        },
      );
    });
  }

  async function uploadAudio(blob: Blob) {
    const extension = blob.type.includes("wav") ? "wav" : "webm";
    const file = new File([blob], `recording.${extension}`, {
      type: blob.type || "audio/webm",
    });

    const formData = new FormData();
    formData.append("audio", file);

    setIsTranscribing(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          extractApiError(payload, "Could not transcribe audio."),
        );
      }

      setPrompt(payload.transcript ?? "");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not transcribe audio.";
      setErrorMessage(message);
    } finally {
      setIsTranscribing(false);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("This browser does not support microphone capture.");
      return;
    }

    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        void uploadAudio(blob);
      });

      recorder.start();
      setIsRecording(true);
    } catch {
      setErrorMessage("Microphone permission denied or unavailable.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsPlanning(true);
    setErrorMessage(null);
    setResult(null);

    try {
      let locationBias = currentLocation;

      if (!locationBias) {
        locationBias = await requestCurrentLocation();
      }

      const response = await fetch("/api/plan-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          ...(homeAddress.trim().length > 0
            ? { homeAddress: homeAddress.trim() }
            : {}),
          ...(locationBias ? { locationBias } : {}),
        }),
      });

      const payload = (await response.json()) as RoutePlanResponse | ApiFailure;

      if (!response.ok) {
        throw new Error(extractApiError(payload, "Could not plan route."));
      }

      setResult(payload as RoutePlanResponse);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not plan route.";
      setErrorMessage(message);
    } finally {
      setIsPlanning(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-black">
            PathSeeker
          </h1>
          <p className="max-w-2xl text-sm text-neutral-700">
            Describe your errands in plain language. PathSeeker extracts stops,
            optimizes your route, and returns a traffic-aware ETA.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Trip Request</CardTitle>
          <CardDescription>
            Voice or text input with AI-powered stop extraction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="home-address">Home Address</Label>
              <Input
                id="home-address"
                value={homeAddress}
                onChange={(event) => setHomeAddress(event.target.value)}
                placeholder="123 Main St, Evanston, IL 60201"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-neutral-600">
                  Saved locally and used when your trip mentions home.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void requestCurrentLocation();
                  }}
                  disabled={isLocating || isPlanning || isTranscribing}
                >
                  {isLocating
                    ? "Getting Location..."
                    : currentLocation
                      ? "Location Ready"
                      : "Use Current Location"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trip-prompt">Request</Label>
              <Textarea
                id="trip-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="I need to go to Target, UPS, and home before 6 PM."
                rows={5}
              />
              <p className="text-xs text-neutral-600">
                You can type vague stops. PathSeeker uses your current area and
                saved home address to resolve them.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing || isPlanning || isLocating}
              >
                {isRecording ? "Stop Recording" : "Record Voice"}
              </Button>
              <Button
                type="submit"
                disabled={
                  isPlanning ||
                  isTranscribing ||
                  isLocating ||
                  prompt.trim().length === 0
                }
              >
                {isPlanning ? "Planning Route..." : "Plan Route"}
              </Button>
            </div>

            {(isTranscribing || isPlanning || isLocating) && (
              <p className="text-sm text-neutral-700">
                {isTranscribing
                  ? "Transcribing audio..."
                  : isLocating
                    ? "Getting location..."
                    : "Planning route..."}
              </p>
            )}

            {errorMessage && (
              <p className="text-sm font-medium text-black">{errorMessage}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Route Result</CardTitle>
            <CardDescription>
              Resolved stops, optimized order, and trip timing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Provider: {result.meta.provider}</Badge>
              <Badge>Model: {result.meta.model}</Badge>
              {result.route.originLabel && (
                <Badge variant="outline">
                  Starting From: {result.route.originLabel}
                </Badge>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
              <Card className="bg-neutral-50">
                <CardHeader className="space-y-4">
                  <div className="space-y-2">
                    <CardDescription>Parsed Stops</CardDescription>
                    <div className="flex flex-wrap gap-2">
                      {result.parsed.stops.map((stop) => (
                        <Badge key={stop} variant="outline">
                          {stop}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <CardDescription>Optimized Order</CardDescription>
                    <ol className="space-y-2">
                      {result.route.orderedStops.map((stop, index) => (
                        <li
                          key={`${stop}-${index}`}
                          className="flex items-start gap-3 rounded-md border border-black/10 bg-white px-3 py-3 text-sm text-neutral-800"
                        >
                          <Badge className="min-w-6 justify-center px-2 py-1">
                            {index + 1}
                          </Badge>
                          <span className="pt-0.5">{stop}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                <Card className="bg-neutral-50">
                  <CardHeader>
                    <CardDescription>Total Duration</CardDescription>
                    <CardTitle className="text-3xl">
                      {result.route.totalDurationText}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-neutral-50">
                  <CardHeader>
                    <CardDescription>Estimated Arrival</CardDescription>
                    <CardTitle className="text-3xl">
                      {arrivalTime ?? "Unavailable"}
                    </CardTitle>
                  </CardHeader>
                </Card>
                {result.parsed.deadline && (
                  <Card className="bg-neutral-50">
                    <CardHeader>
                      <CardDescription>Requested Deadline</CardDescription>
                      <CardTitle className="text-3xl">
                        {result.parsed.deadline}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
