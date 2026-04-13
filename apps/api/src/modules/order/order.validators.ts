import { z } from "zod";

export const placeOrderSchema = z.object({
  listingId: z.string().min(1),
  qty: z.number().positive(),
  idempotencyKey: z.string().uuid()
});
