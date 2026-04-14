import { z } from "zod";

export const createListingSchema = z.object({
  crop: z.string().min(2).max(50),
  qualityGrade: z.enum(["A", "B", "C"]),
  quantity: z.number().positive(),
  unit: z.enum(["kg", "quintal", "ton"]),
  pricePerUnit: z.number().positive(),
  harvestDate: z.string().datetime(),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        width: z.number().int().positive(),
        height: z.number().int().positive()
      })
    )
    .max(8),
  location: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
  }),
  locationMeta: z.object({
    state: z.string().min(2),
    district: z.string().min(2),
    mandi: z.string().min(2)
  })
});

export const listListingQuerySchema = z.object({
  crop: z.string().optional(),
  state: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const listMyListingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const updateListingStatusSchema = z.object({
  status: z.enum(["paused", "sold_out", "archived"])
});
