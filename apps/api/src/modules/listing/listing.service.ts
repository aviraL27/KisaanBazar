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

  return { listing: dto };
}
