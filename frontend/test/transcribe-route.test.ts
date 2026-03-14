import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/transcription", () => ({
  transcribeAudio: vi.fn(),
}));

import { handleTranscribeRequest } from "@/app/api/transcribe/route";
import { transcribeAudio } from "@/lib/providers/transcription";

const mockedTranscribeAudio = vi.mocked(transcribeAudio);

describe("handleTranscribeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns transcript for valid audio", async () => {
    mockedTranscribeAudio.mockResolvedValue("go to target and home");

    const formData = new FormData();
    const file = new File([new Blob(["audio"])], "recording.webm", { type: "audio/webm" });
    formData.append("audio", file);

    const result = await handleTranscribeRequest(formData);

    expect(result.transcript).toBe("go to target and home");
  });

  it("rejects unsupported audio type", async () => {
    const formData = new FormData();
    const file = new File([new Blob(["audio"])], "recording.txt", { type: "text/plain" });
    formData.append("audio", file);

    await expect(handleTranscribeRequest(formData)).rejects.toThrow("Unsupported audio format.");
  });

  it("accepts browser-recorded webm audio with codec metadata", async () => {
    mockedTranscribeAudio.mockResolvedValue("go to target and home");

    const formData = new FormData();
    const file = new File([new Blob(["audio"])], "recording.webm", { type: "audio/webm;codecs=opus" });
    formData.append("audio", file);

    const result = await handleTranscribeRequest(formData);

    expect(result.transcript).toBe("go to target and home");
  });

  it("rejects missing audio file", async () => {
    const formData = new FormData();

    await expect(handleTranscribeRequest(formData)).rejects.toThrow("Audio file is required.");
  });

  it("propagates provider errors", async () => {
    mockedTranscribeAudio.mockRejectedValue(new Error("transcription upstream failure"));

    const formData = new FormData();
    const file = new File([new Blob(["audio"])], "recording.webm", { type: "audio/webm" });
    formData.append("audio", file);

    await expect(handleTranscribeRequest(formData)).rejects.toThrow("transcription upstream failure");
  });
});
