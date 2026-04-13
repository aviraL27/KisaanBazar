import type {
  ManualIngestPriceInput,
  ManualIngestPricesResponse,
  PriceHistoryResponse,
  PriceLatestResponse
} from "@kisaanbazar/shared";
import { cacheKeys } from "../../cache/keys.js";
import { isMongoConnected } from "../../config/mongodb.js";
import { getRedis } from "../../config/redis.js";
import { MandiPriceModel } from "./price.model.js";
import { toPricePointDto } from "./price.mapper.js";

export class PriceServiceError extends Error {
  constructor(public readonly code: "MONGO_UNAVAILABLE" | "NOT_FOUND", message: string) {
    super(message);
  }
}

export async function getLatestPrice(crop: string, mandi: string): Promise<PriceLatestResponse> {
  if (!isMongoConnected()) {
    throw new PriceServiceError("MONGO_UNAVAILABLE", "MongoDB is not connected");
  }

  const normalizedCrop = crop.trim().toLowerCase();
  const normalizedMandi = mandi.trim().toLowerCase();
  const key = cacheKeys.priceLatest(normalizedCrop, normalizedMandi);

  const redis = getRedis();
  if (redis) {
    const cached = await redis.get(key);
    if (cached) {
      return { price: JSON.parse(cached), source: "cache" };
    }
  }

  const doc = await MandiPriceModel.findOne({ crop: normalizedCrop, mandi: normalizedMandi })
    .sort({ ts: -1 })
    .exec();

  if (!doc) {
    throw new PriceServiceError("NOT_FOUND", "Price not found");
  }

  const dto = toPricePointDto(doc);
  if (redis) {
    await redis.set(key, JSON.stringify(dto), "EX", 900);
  }

  return { price: dto, source: "db" };
}

export async function getPriceHistory(params: {
  crop: string;
  mandi: string;
  days: number;
}): Promise<PriceHistoryResponse> {
  if (!isMongoConnected()) {
    throw new PriceServiceError("MONGO_UNAVAILABLE", "MongoDB is not connected");
  }

  const normalizedCrop = params.crop.trim().toLowerCase();
  const normalizedMandi = params.mandi.trim().toLowerCase();
  const from = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);

  const docs = await MandiPriceModel.find({
    crop: normalizedCrop,
    mandi: normalizedMandi,
    ts: { $gte: from }
  })
    .sort({ ts: 1 })
    .limit(2000)
    .exec();

  return {
    crop: normalizedCrop,
    mandi: normalizedMandi,
    points: docs.map((doc) => toPricePointDto(doc))
  };
}

export async function ingestPricesManually(prices: ManualIngestPriceInput[]): Promise<ManualIngestPricesResponse> {
  if (!isMongoConnected()) {
    throw new PriceServiceError("MONGO_UNAVAILABLE", "MongoDB is not connected");
  }

  const documents = prices.map((price) => ({
    crop: price.crop.trim().toLowerCase(),
    mandi: price.mandi.trim().toLowerCase(),
    state: price.state.trim().toLowerCase(),
    district: price.district.trim().toLowerCase(),
    unit: price.unit,
    modalPrice: price.modalPrice,
    minPrice: price.minPrice,
    maxPrice: price.maxPrice,
    ts: new Date(price.ts),
    source: "manual" as const
  }));

  const result = await MandiPriceModel.insertMany(documents, { ordered: false });

  const redis = getRedis();
  if (redis) {
    const pipeline = redis.pipeline();
    for (const doc of result) {
      const dto = toPricePointDto(doc);
      pipeline.set(cacheKeys.priceLatest(dto.crop, dto.mandi), JSON.stringify(dto), "EX", 900);
    }

    await pipeline.exec();
  }

  return { insertedCount: result.length };
}
