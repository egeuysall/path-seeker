import { ApiRouteError } from "@/lib/api-response";
import { getElevenLabsApiKey } from "@/lib/env";

type ElevenLabsResponse = {
  text?: string;
  transcript?: string;
  error?: {
    message?: string;
  };
};

function extractTranscript(payload: ElevenLabsResponse): string | undefined {
  const raw = payload.text ?? payload.transcript;

  if (!raw) {
    return undefined;
  }

  const cleaned = raw.trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export async function transcribeAudio(file: File): Promise<string> {
  const apiKey = getElevenLabsApiKey();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model_id", "scribe_v1");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  const payload = (await response.json()) as ElevenLabsResponse;

  if (!response.ok) {
    const message = payload.error?.message ?? "ElevenLabs transcription failed.";
    throw new ApiRouteError(502, "UPSTREAM_ERROR", message);
  }

  const transcript = extractTranscript(payload);

  if (!transcript) {
    throw new ApiRouteError(502, "UPSTREAM_ERROR", "No transcript returned by ElevenLabs.");
  }

  return transcript;
}
