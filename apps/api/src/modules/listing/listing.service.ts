import type {
  CreateListingInput,
  CreateListingResponse,
  ListListingsResponse,
  ListingDetailResponse
} from "@kisaanbazar/shared";
import { cacheKeys } from "../../cache/keys.js";
import { getRedis } from "../../config/redis.js";
import { ListingModel } from "./listing.model.js";
import { toListingDto } from "./listing.mapper.js";

export async function createListing(farmerId: string, input: CreateListingInput): Promise<CreateListingResponse> {
  const created = await ListingModel.create({
    farmerId,
    crop: input.crop,
    qualityGrade: input.qualityGrade,
    quantity: input.quantity,
    unit: input.unit,
    pricePerUnit: input.pricePerUnit,
    harvestDate: new Date(input.harvestDate),
    images: input.images,
    location: input.location,
    locationMeta: input.locationMeta,
    status: "active"
  });

  const dto = toListingDto(created);
  const redis = getRedis();
  if (redis) {
    await redis.set(cacheKeys.listingDetail(dto.id), JSON.stringify(dto), "EX", 300);
  }

  return { listing: dto };
}

export async function getListingById(id: string): Promise<ListingDetailResponse | null> {
  const redis = getRedis();

  if (redis) {
    const cached = await redis.get(cacheKeys.listingDetail(id));
    if (cached) {
      return { listing: JSON.parse(cached) };
    }
  }

  const doc = await ListingModel.findById(id).exec();
  if (!doc) {
    return null;
  }

  const dto = toListingDto(doc);
  if (redis) {
    await redis.set(cacheKeys.listingDetail(id), JSON.stringify(dto), "EX", 300);
  }

  return { listing: dto };
}

export async function listListings(filters: {
  crop?: string | undefined;
  state?: string | undefined;
  limit: number;
}): Promise<ListListingsResponse> {
  const query: Record<string, unknown> = { status: "active" };

  if (filters.crop) {
    query.crop = filters.crop;
  }

  if (filters.state) {
    query["locationMeta.state"] = filters.state;
  }

  const docs = await ListingModel.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit)
    .exec();

  const listings = docs.map((doc: typeof docs[number]) => toListingDto(doc));
  return { listings, count: listings.length };
}
