import type {
  CreateListingInput,
  CreateListingResponse,
  ListMyListingsResponse,
  ListListingsResponse,
  ListingDetailResponse,
  UpdateListingStatusInput,
  UpdateListingStatusResponse,
  UserRole
} from "@kisaanbazar/shared";
import { cacheKeys } from "../../cache/keys.js";
import { getRedis } from "../../config/redis.js";
import { ListingModel } from "./listing.model.js";
import { toListingDto } from "./listing.mapper.js";

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

async function invalidateListingListCache(): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }

  const keys = await redis.keys("kmb:listing:list:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export class ListingError extends Error {
  constructor(
    public readonly code: "LISTING_NOT_FOUND" | "FORBIDDEN",
    message: string
  ) {
    super(message);
  }
}

export async function createListing(farmerId: string, input: CreateListingInput): Promise<CreateListingResponse> {
  const created = await ListingModel.create({
    farmerId,
    crop: normalizeValue(input.crop),
    qualityGrade: input.qualityGrade,
    quantity: input.quantity,
    unit: input.unit,
    pricePerUnit: input.pricePerUnit,
    harvestDate: new Date(input.harvestDate),
    images: input.images,
    location: input.location,
    locationMeta: {
      state: normalizeValue(input.locationMeta.state),
      district: normalizeValue(input.locationMeta.district),
      mandi: normalizeValue(input.locationMeta.mandi)
    },
    status: "active"
  });

  const dto = toListingDto(created);
  const redis = getRedis();
  if (redis) {
    await redis.set(cacheKeys.listingDetail(dto.id), JSON.stringify(dto), "EX", 300);
  }

  await invalidateListingListCache();

  return { listing: dto };
}

export async function getListingById(id: string): Promise<ListingDetailResponse | null> {
  const normalizedId = id.trim();
  const redis = getRedis();

  if (redis) {
    const cached = await redis.get(cacheKeys.listingDetail(normalizedId));
    if (cached) {
      return { listing: JSON.parse(cached) };
    }
  }

  const doc = await ListingModel.findById(normalizedId).exec();
  if (!doc) {
    return null;
  }

  const dto = toListingDto(doc);
  if (redis) {
    await redis.set(cacheKeys.listingDetail(normalizedId), JSON.stringify(dto), "EX", 300);
  }

  return { listing: dto };
}

export async function listListings(filters: {
  crop?: string | undefined;
  state?: string | undefined;
  limit: number;
}): Promise<ListListingsResponse> {
  const normalizedCrop = filters.crop ? normalizeValue(filters.crop) : undefined;
  const normalizedState = filters.state ? normalizeValue(filters.state) : undefined;
  const cacheKey = cacheKeys.listingList(normalizedCrop ?? "all", normalizedState ?? "all", filters.limit);
  const redis = getRedis();

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ListListingsResponse;
    }
  }

  const query: Record<string, unknown> = { status: "active" };

  if (normalizedCrop) {
    query.crop = normalizedCrop;
  }

  if (normalizedState) {
    query["locationMeta.state"] = normalizedState;
  }

  const docs = await ListingModel.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit)
    .exec();

  const listings = docs.map((doc: typeof docs[number]) => toListingDto(doc));
  const payload = { listings, count: listings.length };

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(payload), "EX", 120);
  }

  return payload;
}

export async function listMyListings(params: {
  farmerId: string;
  limit: number;
}): Promise<ListMyListingsResponse> {
  const docs = await ListingModel.find({ farmerId: params.farmerId })
    .sort({ createdAt: -1 })
    .limit(params.limit)
    .exec();

  const listings = docs.map((doc: typeof docs[number]) => toListingDto(doc));
  return { listings, count: listings.length };
}

export async function updateListingStatus(params: {
  listingId: string;
  actorUid: string;
  actorRole: UserRole;
  input: UpdateListingStatusInput;
}): Promise<UpdateListingStatusResponse> {
  const query: Record<string, string> = { _id: params.listingId };
  if (params.actorRole !== "admin") {
    query.farmerId = params.actorUid;
  }

  const updated = await ListingModel.findOneAndUpdate(
    query,
    {
      $set: {
        status: params.input.status,
        updatedAt: new Date()
      }
    },
    { new: true }
  ).exec();

  if (!updated) {
    const exists = await ListingModel.exists({ _id: params.listingId }).exec();
    if (!exists) {
      throw new ListingError("LISTING_NOT_FOUND", "Listing not found");
    }

    throw new ListingError("FORBIDDEN", "Cannot modify this listing");
  }

  const dto = toListingDto(updated);
  const redis = getRedis();
  if (redis) {
    await redis.set(cacheKeys.listingDetail(dto.id), JSON.stringify(dto), "EX", 300);
  }

  await invalidateListingListCache();

  return { listing: dto };
}
