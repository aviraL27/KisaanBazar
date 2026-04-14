import { config } from "dotenv";
import { z } from "zod";

config();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false" || normalized === "") {
      return false;
    }
  }

  return value;
}, z.boolean());

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  return value;
}, z.string().min(1).optional());

const optionalEmail = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  return value;
}, z.string().email().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  FIREBASE_PROJECT_ID: optionalNonEmptyString,
  FIREBASE_CLIENT_EMAIL: optionalEmail,
  FIREBASE_PRIVATE_KEY: optionalNonEmptyString,
  FIREBASE_WEB_API_KEY: optionalNonEmptyString,
  FIREBASE_AUTH_ENFORCED: booleanFromEnv.default(false),
  FIREBASE_ADMIN_EMAILS: z.string().optional(),
  FIREBASE_FARMER_EMAILS: z.string().optional(),
  FIREBASE_DEFAULT_ROLE: z.enum(["buyer", "farmer", "admin"]).default("buyer"),
  MANDI_API_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  MONGODB_URI: z.string().min(1).optional()
});

export const env = EnvSchema.parse(process.env);
