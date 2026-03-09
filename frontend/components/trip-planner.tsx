"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { RoutePlanResponse } from "@/lib/types";

type ApiFailure = {
  error?: {
    message?: string;
  };
};

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
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<RoutePlanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const arrivalTime = useMemo(() => formatArrivalTime(result?.route.arrivalEstimate), [result]);

  async function uploadAudio(blob: Blob) {
    const extension = blob.type.includes("wav") ? "wav" : "webm";
    const file = new File([blob], `recording.${extension}`, { type: blob.type || "audio/webm" });

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
        throw new Error(extractApiError(payload, "Could not transcribe audio."));
      }

      setPrompt(payload.transcript ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not transcribe audio.";
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
      const response = await fetch("/api/plan-route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const payload = (await response.json()) as RoutePlanResponse | ApiFailure;

      if (!response.ok) {
        throw new Error(extractApiError(payload, "Could not plan route."));
      }

      setResult(payload as RoutePlanResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not plan route.";
      setErrorMessage(message);
    } finally {
      setIsPlanning(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <Badge variant="outline">MVP</Badge>
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight text-black">PathSeeker</h1>
          <p className="max-w-2xl text-sm text-neutral-700">
            Describe your errands in plain language. PathSeeker extracts stops, optimizes your route, and returns
            a traffic-aware ETA.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Trip Request</CardTitle>
          <CardDescription>Voice or text input with AI-powered stop extraction.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="trip-prompt">Request</Label>
              <Textarea
                id="trip-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="I need to go to Target, UPS, and home before 6 PM."
                rows={5}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing || isPlanning}
              >
                {isRecording ? "Stop Recording" : "Record Voice"}
              </Button>
              <Button type="submit" disabled={isPlanning || isTranscribing || prompt.trim().length === 0}>
                {isPlanning ? "Planning Route..." : "Plan Route"}
              </Button>
            </div>

            {(isTranscribing || isPlanning) && (
              <p className="text-sm text-neutral-700">{isTranscribing ? "Transcribing audio..." : "Planning route..."}</p>
            )}

            {errorMessage && <p className="text-sm font-medium text-black">{errorMessage}</p>}
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Route Result</CardTitle>
            <CardDescription>
              Provider: {result.meta.provider} | Model: {result.meta.model}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Parsed Stops</h2>
              <ul className="space-y-1 text-sm text-neutral-800">
                {result.parsed.stops.map((stop) => (
                  <li key={stop}>{stop}</li>
                ))}
              </ul>
            </section>

            <Separator />

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Optimized Order</h2>
              <ol className="space-y-1 text-sm text-neutral-800">
                {result.route.orderedStops.map((stop, index) => (
                  <li key={`${stop}-${index}`}>
                    {index + 1}. {stop}
                  </li>
                ))}
              </ol>
            </section>

            <Separator />

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Total Duration</h3>
                <p className="text-sm text-black">{result.route.totalDurationText}</p>
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Estimated Arrival</h3>
                <p className="text-sm text-black">{arrivalTime ?? "Unavailable"}</p>
              </div>
            </section>

            {result.parsed.deadline && (
              <section className="space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Requested Deadline</h3>
                <p className="text-sm text-black">{result.parsed.deadline}</p>
              </section>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
