import type {
  ManualIngestPriceInput,
  ManualIngestPricesResponse,
  PriceAlertsResponse,
  PriceHistoryResponse,
  PriceLatestResponse,
  PriceRegionalInsightsResponse,
  RegionalPriceInsight
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

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateTrend(modalPrices: number[]): RegionalPriceInsight["trend"] {
  if (modalPrices.length < 4) {
    return "stable";
  }

  const split = Math.max(2, Math.floor(modalPrices.length / 2));
  const earlyAvg = mean(modalPrices.slice(0, split));
  const lateAvg = mean(modalPrices.slice(split));

  if (earlyAvg === 0) {
    return "stable";
  }

  const deltaPct = ((lateAvg - earlyAvg) / earlyAvg) * 100;
  if (deltaPct > 3) {
    return "up";
  }

  if (deltaPct < -3) {
    return "down";
  }

  return "stable";
}

export async function getPriceAlerts(params: {
  crop: string;
  mandi: string;
  days: number;
  zThreshold: number;
}): Promise<PriceAlertsResponse> {
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

  const points = docs.map((doc) => toPricePointDto(doc));
  const modalPrices = points.map((point) => point.modalPrice);
  const windowAvg = Number(mean(modalPrices).toFixed(2));
  const sigma = standardDeviation(modalPrices);

  const alerts = points
    .map((point) => {
      if (sigma === 0) {
        return null;
      }

      const zScore = (point.modalPrice - windowAvg) / sigma;
      if (Math.abs(zScore) < params.zThreshold) {
        return null;
      }

      const deviationPct = windowAvg === 0 ? 0 : ((point.modalPrice - windowAvg) / windowAvg) * 100;
      return {
        ts: point.ts,
        modalPrice: point.modalPrice,
        baselinePrice: windowAvg,
        zScore: Number(zScore.toFixed(2)),
        deviationPct: Number(deviationPct.toFixed(2)),
        severity: Math.abs(zScore) >= params.zThreshold * 1.5 ? "high" : "medium"
      };
    })
    .filter((item): item is PriceAlertsResponse["alerts"][number] => item !== null);

  const latest = points.at(-1);

  return {
    crop: normalizedCrop,
    mandi: normalizedMandi,
    days: params.days,
    ...(latest ? { latest } : {}),
    windowAvg,
    alerts
  };
}

export async function getRegionalInsights(params: {
  crop: string;
  days: number;
}): Promise<PriceRegionalInsightsResponse> {
  if (!isMongoConnected()) {
    throw new PriceServiceError("MONGO_UNAVAILABLE", "MongoDB is not connected");
  }

  const normalizedCrop = params.crop.trim().toLowerCase();
  const from = new Date(Date.now() - params.days * 24 * 60 * 60 * 1000);

  const docs = await MandiPriceModel.find({
    crop: normalizedCrop,
    ts: { $gte: from }
  })
    .sort({ ts: 1 })
    .limit(6000)
    .exec();

  const groupedByState = new Map<string, typeof docs>();
  for (const doc of docs) {
    const bucket = groupedByState.get(doc.state) ?? [];
    bucket.push(doc);
    groupedByState.set(doc.state, bucket);
  }

  const regions: RegionalPriceInsight[] = [];

  for (const [state, stateDocs] of groupedByState.entries()) {
    const latestByMandi = new Map<string, (typeof stateDocs)[number]>();
    for (const doc of stateDocs) {
      const existing = latestByMandi.get(doc.mandi);
      if (!existing || existing.ts < doc.ts) {
        latestByMandi.set(doc.mandi, doc);
      }
    }

    const latestPrices = Array.from(latestByMandi.values()).map((doc) => doc.modalPrice);
    if (latestPrices.length === 0) {
      continue;
    }

    const historicalPrices = stateDocs.map((doc) => doc.modalPrice);
    const volatility = mean(historicalPrices) === 0 ? 0 : (standardDeviation(historicalPrices) / mean(historicalPrices)) * 100;

    regions.push({
      state,
      mandiCount: latestPrices.length,
      latestModalPriceAvg: Number(mean(latestPrices).toFixed(2)),
      latestModalPriceMin: Math.min(...latestPrices),
      latestModalPriceMax: Math.max(...latestPrices),
      sevenDayVolatilityPct: Number(volatility.toFixed(2)),
      trend: calculateTrend(historicalPrices)
    });
  }

  regions.sort((a, b) => b.latestModalPriceAvg - a.latestModalPriceAvg);

  return {
    crop: normalizedCrop,
    days: params.days,
    generatedAt: new Date().toISOString(),
    regions
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
