import type { Order } from "@kisaanbazar/shared";
import type { OrderDocument } from "./order.model.js";

export function toOrderDto(doc: OrderDocument): Order {
  return {
    id: doc._id.toString(),
    buyerId: doc.buyerId,
    farmerId: doc.farmerId,
    listingId: doc.listingId,
    status: doc.status,
    amountTotal: doc.amountTotal,
    item: doc.item,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}
