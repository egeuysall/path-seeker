import type { ApiErrorCode } from "@/lib/types";

type EnvKey =
  | "AI_GATEWAY_API_KEY"
  | "AI_MODEL"
  | "AI_GATEWAY_BASE_URL"
  | "ELEVENLABS_API_KEY"
  | "GOOGLE_MAPS_API_KEY";

const defaults: Partial<Record<EnvKey, string>> = {
  AI_MODEL: "openai/gpt-4.1-mini",
  AI_GATEWAY_BASE_URL: "https://ai-gateway.vercel.sh/v1",
};

class EnvError extends Error {
  public readonly code: ApiErrorCode;

  constructor(message: string, code: ApiErrorCode = "INTERNAL_ERROR") {
    super(message);
    this.code = code;
    this.name = "EnvError";
  }
}

function getEnv(key: EnvKey): string {
  const value = process.env[key] ?? defaults[key];

  if (!value) {
    throw new EnvError(`${key} is not configured.`, "INTERNAL_ERROR");
  }

  return value;
}

export function getAiGatewayConfig() {
  return {
    apiKey: getEnv("AI_GATEWAY_API_KEY"),
    model: getEnv("AI_MODEL"),
    baseURL: getEnv("AI_GATEWAY_BASE_URL"),
  };
}

export function getGoogleMapsApiKey() {
  return getEnv("GOOGLE_MAPS_API_KEY");
}

export function getElevenLabsApiKey() {
  return getEnv("ELEVENLABS_API_KEY");
}

export { EnvError };
