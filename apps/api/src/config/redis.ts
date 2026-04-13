import { Redis } from "ioredis";
import { env } from "./env.js";

let redis: Redis | null = null;

export async function connectRedis(): Promise<void> {
  if (redis) {
    return;
  }

  if (!env.REDIS_URL) {
    console.warn(JSON.stringify({ level: "warn", msg: "REDIS_URL not set. Redis features disabled." }));
    return;
  }

  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true
  });

  client.on("error", (err: Error) => {
    console.error(JSON.stringify({ level: "error", msg: "Redis error", error: err.message }));
  });

  await client.ping();
  redis = client;
  console.log(JSON.stringify({ level: "info", msg: "Redis connected" }));
}

export function getRedis(): Redis | null {
  return redis;
}
