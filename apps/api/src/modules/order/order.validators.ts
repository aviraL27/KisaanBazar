import { z } from "zod";

export const placeOrderSchema = z.object({
  listingId: z.string().min(1),
  qty: z.number().positive(),
  idempotencyKey: z.string().uuid()
});

export const listMyOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
