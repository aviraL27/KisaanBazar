import type { Request, Response } from "express";
import { fail, ok } from "../../shared/http.js";
import { getLatestPrice, getPriceHistory, ingestPricesManually, PriceServiceError } from "./price.service.js";
import { latestPriceQuerySchema, manualIngestSchema, priceHistoryQuerySchema } from "./price.validators.js";

export async function getLatestPriceHandler(req: Request, res: Response): Promise<void> {
  const parsed = latestPriceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json(fail(req.id, "VALIDATION_ERROR", parsed.error.message));
    return;
  }

  try {
    const result = await getLatestPrice(parsed.data.crop, parsed.data.mandi);
    res.status(200).json(ok(req.id, result));
  } catch (error) {
    if (error instanceof PriceServiceError) {
      if (error.code === "MONGO_UNAVAILABLE") {
        res.status(503).json(fail(req.id, error.code, error.message));
        return;
      }

      if (error.code === "NOT_FOUND") {
        res.status(404).json(fail(req.id, error.code, error.message));
        return;
      }
    }

    res.status(500).json(fail(req.id, "INTERNAL_ERROR", "Failed to fetch latest price"));
  }
}

export async function getPriceHistoryHandler(req: Request, res: Response): Promise<void> {
  const parsed = priceHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json(fail(req.id, "VALIDATION_ERROR", parsed.error.message));
    return;
  }

  try {
    const result = await getPriceHistory(parsed.data);
    res.status(200).json(ok(req.id, result));
  } catch (error) {
    if (error instanceof PriceServiceError && error.code === "MONGO_UNAVAILABLE") {
      res.status(503).json(fail(req.id, error.code, error.message));
      return;
    }

    res.status(500).json(fail(req.id, "INTERNAL_ERROR", "Failed to fetch price history"));
  }
}

export async function ingestManualPricesHandler(req: Request, res: Response): Promise<void> {
  const parsed = manualIngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json(fail(req.id, "VALIDATION_ERROR", parsed.error.message));
    return;
  }

  try {
    const result = await ingestPricesManually(parsed.data.prices);
    res.status(201).json(ok(req.id, result));
  } catch (error) {
    if (error instanceof PriceServiceError && error.code === "MONGO_UNAVAILABLE") {
      res.status(503).json(fail(req.id, error.code, error.message));
      return;
    }

    res.status(500).json(fail(req.id, "INTERNAL_ERROR", "Failed to ingest prices"));
  }
}
