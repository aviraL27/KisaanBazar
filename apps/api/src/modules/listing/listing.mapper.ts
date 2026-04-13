import type { Listing } from "@kisaanbazar/shared";
import type { ListingDocument } from "./listing.model.js";

export function toListingDto(doc: ListingDocument): Listing {
  const locationMeta = doc.locationMeta ?? {
    state: "unknown",
    district: "unknown",
    mandi: "unknown"
  };

  return {
    id: doc._id.toString(),
    farmerId: doc.farmerId,
    crop: doc.crop,
    qualityGrade: doc.qualityGrade,
    quantity: doc.quantity,
    unit: doc.unit,
    pricePerUnit: doc.pricePerUnit,
    harvestDate: doc.harvestDate.toISOString(),
    images: doc.images,
    locationMeta,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}
