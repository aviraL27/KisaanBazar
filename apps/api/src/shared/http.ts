import type { ApiError, ApiSuccess } from "@kisaanbazar/shared";

export function ok<T>(requestId: string, data: T): ApiSuccess<T> {
  return { ok: true, requestId, data };
}

export function fail(requestId: string, code: string, message: string): ApiError {
  return { ok: false, requestId, code, message };
}
