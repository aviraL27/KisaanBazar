import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  getPriceAlertsHandler,
  getLatestPriceHandler,
  getPriceHistoryHandler,
  getPriceRegionalInsightsHandler,
  ingestManualPricesHandler
} from "./price.controller.js";

export const priceRouter = Router();

priceRouter.get("/prices/latest", getLatestPriceHandler);
priceRouter.get("/prices/history", getPriceHistoryHandler);
priceRouter.get("/prices/alerts", getPriceAlertsHandler);
priceRouter.get("/prices/insights/regions", getPriceRegionalInsightsHandler);
priceRouter.post("/prices/ingest/manual", requireAuth, requireRole(["admin"]), ingestManualPricesHandler);
