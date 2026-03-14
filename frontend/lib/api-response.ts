import { NextResponse } from "next/server";
import type { ApiError, ApiErrorCode } from "@/lib/types";

export class ApiRouteError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiRouteError";
  }
}

export function jsonError(status: number, code: ApiErrorCode, message: string) {
  const body: { error: ApiError } = {
    error: {
      code,
      message,
    },
  };

  return NextResponse.json(body, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ApiRouteError) {
    return jsonError(error.status, error.code, error.message);
  }

  if (error instanceof Error) {
    return jsonError(500, "INTERNAL_ERROR", error.message);
  }

  return jsonError(500, "INTERNAL_ERROR", "An unknown error occurred.");
}
