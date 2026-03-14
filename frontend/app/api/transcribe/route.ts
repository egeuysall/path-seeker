import { NextResponse } from "next/server";

import { ApiRouteError, handleRouteError } from "@/lib/api-response";
import { transcribeAudio } from "@/lib/providers/transcription";

const allowedMimeTypePrefixes = ["audio/webm", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"];

function isAllowedAudioType(mimeType: string) {
  return allowedMimeTypePrefixes.some((prefix) => mimeType === prefix || mimeType.startsWith(`${prefix};`));
}

export async function handleTranscribeRequest(formData: FormData) {
  const fileValue = formData.get("audio");

  if (!(fileValue instanceof File)) {
    throw new ApiRouteError(400, "BAD_REQUEST", "Audio file is required.");
  }

  if (!isAllowedAudioType(fileValue.type)) {
    throw new ApiRouteError(400, "BAD_REQUEST", "Unsupported audio format.");
  }

  const transcript = await transcribeAudio(fileValue);
  return { transcript };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const data = await handleTranscribeRequest(formData);

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
