import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const OrderSchema = new Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    buyerId: { type: String, required: true, index: true },
    farmerId: { type: String, required: true, index: true },
    listingId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["placed", "confirmed", "countered", "rejected", "shipped", "delivered", "disputed", "cancelled"],
      default: "placed",
      index: true
    },
    amountTotal: { type: Number, required: true },
    item: {
      type: {
        crop: { type: String, required: true },
        qualityGrade: { type: String, enum: ["A", "B", "C"], required: true },
        unit: { type: String, enum: ["kg", "quintal", "ton"], required: true },
        pricePerUnit: { type: Number, required: true },
        qty: { type: Number, required: true }
      },
      required: true
    }
  },
  { timestamps: true }
);

OrderSchema.index({ buyerId: 1, createdAt: -1 });
OrderSchema.index({ farmerId: 1, status: 1, createdAt: -1 });

type OrderSchemaType = InferSchemaType<typeof OrderSchema>;
export type OrderDocument = HydratedDocument<OrderSchemaType>;

const existingModel = mongoose.models.Order as Model<OrderSchemaType> | undefined;
export const OrderModel: Model<OrderSchemaType> = existingModel ?? mongoose.model<OrderSchemaType>("Order", OrderSchema);
