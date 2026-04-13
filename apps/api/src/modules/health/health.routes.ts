import { Router } from "express";
import type { HealthResponse } from "@kisaanbazar/shared";
import { env } from "../../config/env.js";
import { ok } from "../../shared/http.js";

export const healthRouter = Router();

healthRouter.get("/health", (req, res) => {
  const payload: HealthResponse = {
    service: "api",
    status: "ok",
    ts: new Date().toISOString(),
    env: env.NODE_ENV
  };

  res.status(200).json(ok(req.id, payload));
});
