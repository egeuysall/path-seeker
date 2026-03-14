import { createOpenAI } from "@ai-sdk/openai";
import { NoTranscriptGeneratedError, experimental_transcribe as transcribe } from "ai";

import { ApiRouteError } from "@/lib/api-response";
import { getAiTranscriptionConfig } from "@/lib/env";

type OpenAIErrorShape = {
  message?: string;
  cause?: unknown;
};

function extractTranscriptionMessage(error: OpenAIErrorShape) {
  if (error.cause instanceof Error && error.cause.message) {
    return error.cause.message;
  }

  return error.message;
}

export async function transcribeAudio(file: File): Promise<string> {
  const config = getAiTranscriptionConfig();
  const openai = createOpenAI({
    apiKey: config.apiKey,
  });

  try {
    const result = await transcribe({
      model: openai.transcription(config.model),
      audio: new Uint8Array(await file.arrayBuffer()),
      abortSignal: AbortSignal.timeout(30_000),
    });

    const transcript = result.text.trim();

    if (transcript.length === 0) {
      throw new ApiRouteError(502, "UPSTREAM_ERROR", "No transcript returned by the transcription model.");
    }

    return transcript;
  } catch (error) {
    if (error instanceof ApiRouteError) {
      throw error;
    }

    if (NoTranscriptGeneratedError.isInstance(error)) {
      throw new ApiRouteError(502, "UPSTREAM_ERROR", "No transcript returned by the transcription model.");
    }

    const message =
      error && typeof error === "object"
        ? extractTranscriptionMessage(error as OpenAIErrorShape)
        : "Audio transcription failed.";

    throw new ApiRouteError(502, "UPSTREAM_ERROR", message || "Audio transcription failed.");
  }
}
