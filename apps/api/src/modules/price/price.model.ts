import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const MandiPriceSchema = new Schema(
  {
    crop: { type: String, required: true, index: true },
    mandi: { type: String, required: true, index: true },
    state: { type: String, required: true, index: true },
    district: { type: String, required: true },
    unit: { type: String, enum: ["kg", "quintal", "ton"], required: true },
    modalPrice: { type: Number, required: true },
    minPrice: { type: Number, required: true },
    maxPrice: { type: Number, required: true },
    ts: { type: Date, required: true, index: true },
    source: { type: String, enum: ["manual", "external"], default: "manual" }
  },
  { timestamps: true }
);

MandiPriceSchema.index({ crop: 1, mandi: 1, ts: -1 });
MandiPriceSchema.index({ state: 1, district: 1, crop: 1, ts: -1 });

type MandiPriceSchemaType = InferSchemaType<typeof MandiPriceSchema>;
export type MandiPriceDocument = HydratedDocument<MandiPriceSchemaType>;

const existingModel = mongoose.models.MandiPrice as Model<MandiPriceSchemaType> | undefined;
export const MandiPriceModel: Model<MandiPriceSchemaType> =
  existingModel ?? mongoose.model<MandiPriceSchemaType>("MandiPrice", MandiPriceSchema);
