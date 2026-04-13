import mongoose from "mongoose";
import { env } from "./env.js";

let connected = false;

export async function connectMongo(): Promise<void> {
  if (connected) {
    return;
  }

  if (!env.MONGODB_URI) {
    console.warn(JSON.stringify({ level: "warn", msg: "MONGODB_URI not set. Mongo features disabled." }));
    return;
  }

  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 20,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000
  });

  connected = true;
  console.log(JSON.stringify({ level: "info", msg: "MongoDB connected" }));
}

export function isMongoConnected(): boolean {
  return connected;
}
