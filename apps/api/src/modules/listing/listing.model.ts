import { Schema, model, models, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const ListingImageSchema = new Schema(
  {
    url: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  { _id: false }
);

const ListingSchema = new Schema(
  {
    farmerId: { type: String, required: true, index: true },
    crop: { type: String, required: true, index: true },
    qualityGrade: { type: String, enum: ["A", "B", "C"], required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, enum: ["kg", "quintal", "ton"], required: true },
    pricePerUnit: { type: Number, required: true, min: 1 },
    harvestDate: { type: Date, required: true },
    images: { type: [ListingImageSchema], default: [] },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },
    locationMeta: {
      type: {
      state: { type: String, required: true, index: true },
      district: { type: String, required: true },
      mandi: { type: String, required: true }
      },
      required: true
    },
    status: {
      type: String,
      enum: ["active", "paused", "sold_out", "archived"],
      default: "active",
      index: true
    }
  },
  { timestamps: true }
);

ListingSchema.index({ location: "2dsphere" });
ListingSchema.index({ crop: 1, status: 1, pricePerUnit: 1 });

type ListingSchemaType = InferSchemaType<typeof ListingSchema>;

export type ListingDocument = HydratedDocument<ListingSchemaType>;

const existingModel = models.Listing as Model<ListingSchemaType> | undefined;
export const ListingModel: Model<ListingSchemaType> = existingModel ?? model<ListingSchemaType>("Listing", ListingSchema);
