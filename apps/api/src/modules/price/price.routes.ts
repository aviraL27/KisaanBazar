import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  getLatestPriceHandler,
  getPriceHistoryHandler,
  ingestManualPricesHandler
} from "./price.controller.js";

export const priceRouter = Router();

priceRouter.get("/prices/latest", getLatestPriceHandler);
priceRouter.get("/prices/history", getPriceHistoryHandler);
priceRouter.post("/prices/ingest/manual", requireAuth, requireRole(["admin"]), ingestManualPricesHandler);
