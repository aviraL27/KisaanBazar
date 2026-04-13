import express from "express";
import cors from "cors";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { listingRouter } from "./modules/listing/listing.routes.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "256kb" }));
app.use(requestLogger);

app.use((req, _res, next) => {
  req.id = randomUUID();
  next();
});

app.use("/v1", healthRouter);
app.use("/v1", authRouter);
app.use("/v1", listingRouter);
