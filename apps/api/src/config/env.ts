import { config } from "dotenv";
import { z } from "zod";

config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  FIREBASE_AUTH_ENFORCED: z.coerce.boolean().default(false),
  MANDI_API_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  MONGODB_URI: z.string().min(1).optional()
});

export const env = EnvSchema.parse(process.env);
