import { Router } from "express";
import type { HealthDependenciesResponse, HealthResponse } from "@kisaanbazar/shared";
import { env } from "../../config/env.js";
import { isMongoConnected } from "../../config/mongodb.js";
import { getRedis } from "../../config/redis.js";
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

healthRouter.get("/health/dependencies", async (req, res) => {
  const redis = getRedis();
  let cacheRoundTripOk = false;

  if (redis) {
    const key = `kmb:health:cache:${req.id}`;
    await redis.set(key, "ok", "EX", 10);
    const value = await redis.get(key);
    cacheRoundTripOk = value === "ok";
  }

  const payload: HealthDependenciesResponse = {
    mongoConnected: isMongoConnected(),
    redisConnected: Boolean(redis),
    cacheRoundTripOk
  };

  res.status(200).json(ok(req.id, payload));
});
