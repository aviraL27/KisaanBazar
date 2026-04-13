import { z } from "zod";

export const latestPriceQuerySchema = z.object({
  crop: z.string().min(1),
  mandi: z.string().min(1)
});

export const priceHistoryQuerySchema = z.object({
  crop: z.string().min(1),
  mandi: z.string().min(1),
  days: z.coerce.number().int().min(1).max(365).default(7)
});

export const manualIngestSchema = z.object({
  prices: z
    .array(
      z.object({
        crop: z.string().min(1),
        mandi: z.string().min(1),
        state: z.string().min(1),
        district: z.string().min(1),
        unit: z.enum(["kg", "quintal", "ton"]),
        modalPrice: z.number().positive(),
        minPrice: z.number().positive(),
        maxPrice: z.number().positive(),
        ts: z.string().datetime()
      })
    )
    .min(1)
    .max(1000)
});
