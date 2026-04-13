import type { PricePoint } from "@kisaanbazar/shared";
import type { MandiPriceDocument } from "./price.model.js";

export function toPricePointDto(doc: MandiPriceDocument): PricePoint {
  return {
    crop: doc.crop,
    mandi: doc.mandi,
    state: doc.state,
    district: doc.district,
    unit: doc.unit,
    modalPrice: doc.modalPrice,
    minPrice: doc.minPrice,
    maxPrice: doc.maxPrice,
    ts: doc.ts.toISOString()
  };
}
