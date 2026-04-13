export type UserRole = "farmer" | "buyer" | "admin";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  requestId: string;
}

export interface ApiError {
  ok: false;
  code: string;
  message: string;
  requestId: string;
}

export interface HealthResponse {
  service: "api";
  status: "ok";
  ts: string;
  env: "development" | "staging" | "production" | "test";
}
