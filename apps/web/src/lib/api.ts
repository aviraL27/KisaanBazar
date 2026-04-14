import type { ApiError, ApiSuccess } from "@kisaanbazar/shared";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:4000";

export interface ApiRequestOptions {
  token?: string;
  devRole?: "farmer" | "buyer" | "admin";
  devUid?: string;
}

function toUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, API_BASE_URL);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function buildHeaders(options?: ApiRequestOptions): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json"
  };

  if (options?.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options?.devRole) {
    headers["x-dev-role"] = options.devRole;
  }

  if (options?.devUid) {
    headers["x-dev-uid"] = options.devUid;
  }

  return headers;
}

export async function apiGet<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
  options?: ApiRequestOptions
): Promise<T> {
  const response = await fetch(toUrl(path, query), {
    method: "GET",
    headers: buildHeaders(options)
  });

  const payload = (await response.json()) as ApiSuccess<T> | ApiError;

  if (!response.ok || !payload.ok) {
    const message = payload.ok ? "Request failed" : payload.message;
    throw new Error(message);
  }

  return payload.data;
}

export async function apiPost<TResponse, TBody>(
  path: string,
  body: TBody,
  options?: ApiRequestOptions
): Promise<TResponse> {
  const response = await fetch(toUrl(path), {
    method: "POST",
    headers: {
      ...buildHeaders(options),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json()) as ApiSuccess<TResponse> | ApiError;

  if (!response.ok || !payload.ok) {
    const message = payload.ok ? "Request failed" : payload.message;
    throw new Error(message);
  }

  return payload.data;
}

export async function apiPatch<TResponse, TBody>(
  path: string,
  body: TBody,
  options?: ApiRequestOptions
): Promise<TResponse> {
  const response = await fetch(toUrl(path), {
    method: "PATCH",
    headers: {
      ...buildHeaders(options),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json()) as ApiSuccess<TResponse> | ApiError;

  if (!response.ok || !payload.ok) {
    const message = payload.ok ? "Request failed" : payload.message;
    throw new Error(message);
  }

  return payload.data;
}
