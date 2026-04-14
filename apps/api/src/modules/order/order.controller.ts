import type { Request, Response } from "express";
import { fail, ok } from "../../shared/http.js";
import { listMyOrdersQuerySchema, placeOrderSchema } from "./order.validators.js";
import { listMyOrdersForBuyer, OrderError, placeOrder } from "./order.service.js";

export async function placeOrderHandler(req: Request, res: Response): Promise<void> {
  const parsed = placeOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json(fail(req.id, "VALIDATION_ERROR", parsed.error.message));
    return;
  }

  if (!req.user) {
    res.status(401).json(fail(req.id, "UNAUTHORIZED", "Authentication required"));
    return;
  }

  try {
    const result = await placeOrder({
      buyerId: req.user.uid,
      listingId: parsed.data.listingId,
      qty: parsed.data.qty,
      idempotencyKey: parsed.data.idempotencyKey
    });

    res.status(201).json(ok(req.id, result));
  } catch (error) {
    if (error instanceof OrderError) {
      if (error.code === "MONGO_UNAVAILABLE") {
        res.status(503).json(fail(req.id, error.code, error.message));
        return;
      }

      if (error.code === "DUPLICATE_REQUEST" || error.code === "INSUFFICIENT_QUANTITY") {
        res.status(409).json(fail(req.id, error.code, error.message));
        return;
      }

      if (error.code === "LISTING_NOT_FOUND") {
        res.status(404).json(fail(req.id, error.code, error.message));
        return;
      }
    }

    res.status(500).json(fail(req.id, "INTERNAL_ERROR", "Failed to place order"));
  }
}

export async function listMyOrdersHandler(req: Request, res: Response): Promise<void> {
  const parsed = listMyOrdersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json(fail(req.id, "VALIDATION_ERROR", parsed.error.message));
    return;
  }

  if (!req.user) {
    res.status(401).json(fail(req.id, "UNAUTHORIZED", "Authentication required"));
    return;
  }

  const result = await listMyOrdersForBuyer({
    buyerId: req.user.uid,
    limit: parsed.data.limit
  });

  res.status(200).json(ok(req.id, result));
}
