import mongoose from "mongoose";
import type { PlaceOrderResponse } from "@kisaanbazar/shared";
import { cacheKeys } from "../../cache/keys.js";
import { isMongoConnected } from "../../config/mongodb.js";
import { getRedis } from "../../config/redis.js";
import { ListingModel } from "../listing/listing.model.js";
import { OrderModel } from "./order.model.js";
import { toOrderDto } from "./order.mapper.js";

export class OrderError extends Error {
  constructor(
    public readonly code: "MONGO_UNAVAILABLE" | "DUPLICATE_REQUEST" | "LISTING_NOT_FOUND" | "INSUFFICIENT_QUANTITY",
    message: string
  ) {
    super(message);
  }
}

export async function placeOrder(params: {
  buyerId: string;
  listingId: string;
  qty: number;
  idempotencyKey: string;
}): Promise<PlaceOrderResponse> {
  if (!isMongoConnected()) {
    throw new OrderError("MONGO_UNAVAILABLE", "MongoDB is not connected");
  }

  const redis = getRedis();
  const lockKey = `kmb:order:idempotency:${params.idempotencyKey}`;

  if (redis) {
    const lockResult = await redis.set(lockKey, "pending", "EX", 300, "NX");
    if (lockResult !== "OK") {
      throw new OrderError("DUPLICATE_REQUEST", "Duplicate order request");
    }
  }

  const session = await mongoose.startSession();

  try {
    let createdOrderId = "";

    await session.withTransaction(async () => {
      const listing = await ListingModel.findOneAndUpdate(
        {
          _id: params.listingId,
          status: "active",
          quantity: { $gte: params.qty }
        },
        {
          $inc: { quantity: -params.qty },
          $set: { updatedAt: new Date() }
        },
        { new: true, session }
      );

      if (!listing) {
        const exists = await ListingModel.exists({ _id: params.listingId }).session(session);
        if (!exists) {
          throw new OrderError("LISTING_NOT_FOUND", "Listing not found");
        }

        throw new OrderError("INSUFFICIENT_QUANTITY", "Listing quantity is not sufficient");
      }

      if (listing.quantity === 0) {
        listing.status = "sold_out";
        await listing.save({ session });
      }

      const order = await OrderModel.create(
        [
          {
            idempotencyKey: params.idempotencyKey,
            buyerId: params.buyerId,
            farmerId: listing.farmerId,
            listingId: listing._id.toString(),
            status: "placed",
            amountTotal: params.qty * listing.pricePerUnit,
            item: {
              crop: listing.crop,
              qualityGrade: listing.qualityGrade,
              unit: listing.unit,
              pricePerUnit: listing.pricePerUnit,
              qty: params.qty
            }
          }
        ],
        { session }
      );

      const created = order[0];
      if (!created) {
        throw new Error("ORDER_CREATE_FAILED");
      }

      createdOrderId = created._id.toString();
    });

    const saved = await OrderModel.findById(createdOrderId).exec();
    if (!saved) {
      throw new Error("ORDER_NOT_FOUND_AFTER_CREATE");
    }

    if (redis) {
      await redis.del(cacheKeys.listingDetail(params.listingId));
      await redis.publish(
        "kmb:pubsub:orders",
        JSON.stringify({ event: "order.created", orderId: saved._id.toString(), listingId: params.listingId })
      );
      await redis.set(lockKey, `committed:${saved._id.toString()}`, "EX", 86400);
    }

    return { order: toOrderDto(saved) };
  } catch (error) {
    if (error instanceof OrderError) {
      throw error;
    }

    const maybeMongoError = error as { code?: number };
    if (maybeMongoError.code === 11000) {
      throw new OrderError("DUPLICATE_REQUEST", "Duplicate idempotency key");
    }

    throw error;
  } finally {
    await session.endSession();
  }
}
