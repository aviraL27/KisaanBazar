import { isMongoConnected } from "../config/mongodb.js";
import { ListingModel } from "../modules/listing/listing.model.js";
import { MandiPriceModel } from "../modules/price/price.model.js";

function generatePriceSeries(params: {
  crop: string;
  state: string;
  district: string;
  mandi: string;
  basePrice: number;
  unit: "kg" | "quintal" | "ton";
}): Array<{
  crop: string;
  mandi: string;
  state: string;
  district: string;
  unit: "kg" | "quintal" | "ton";
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  ts: Date;
  source: "manual";
}> {
  const points: Array<{
    crop: string;
    mandi: string;
    state: string;
    district: string;
    unit: "kg" | "quintal" | "ton";
    modalPrice: number;
    minPrice: number;
    maxPrice: number;
    ts: Date;
    source: "manual";
  }> = [];

  for (let dayOffset = 30; dayOffset >= 0; dayOffset -= 1) {
    const ts = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
    const wave = Math.sin(dayOffset * 0.45) * 0.06 + Math.cos(dayOffset * 0.32) * 0.03;
    const modalPrice = Math.max(1, Math.round(params.basePrice * (1 + wave)));

    points.push({
      crop: params.crop,
      mandi: params.mandi,
      state: params.state,
      district: params.district,
      unit: params.unit,
      modalPrice,
      minPrice: Math.max(1, Math.round(modalPrice * 0.92)),
      maxPrice: Math.max(1, Math.round(modalPrice * 1.08)),
      ts,
      source: "manual"
    });
  }

  return points;
}

export async function seedDemoData(): Promise<void> {
  if (!isMongoConnected()) {
    return;
  }

  const [existingListings, existingPrices] = await Promise.all([
    ListingModel.estimatedDocumentCount().exec(),
    MandiPriceModel.estimatedDocumentCount().exec()
  ]);

  if (existingListings === 0) {
    await ListingModel.insertMany(
      [
        {
          farmerId: "farmer-pune-01",
          crop: "wheat",
          qualityGrade: "A",
          quantity: 120,
          unit: "quintal",
          pricePerUnit: 2460,
          harvestDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          images: [],
          location: { type: "Point", coordinates: [73.8567, 18.5204] },
          locationMeta: { state: "maharashtra", district: "pune", mandi: "pune" },
          status: "active"
        },
        {
          farmerId: "farmer-nashik-02",
          crop: "onion",
          qualityGrade: "A",
          quantity: 80,
          unit: "quintal",
          pricePerUnit: 1980,
          harvestDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          images: [],
          location: { type: "Point", coordinates: [73.7898, 19.9975] },
          locationMeta: { state: "maharashtra", district: "nashik", mandi: "lasalgaon" },
          status: "active"
        },
        {
          farmerId: "farmer-kota-03",
          crop: "soybean",
          qualityGrade: "B",
          quantity: 60,
          unit: "quintal",
          pricePerUnit: 4520,
          harvestDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          images: [],
          location: { type: "Point", coordinates: [75.8648, 25.2138] },
          locationMeta: { state: "rajasthan", district: "kota", mandi: "kota" },
          status: "active"
        }
      ],
      { ordered: true }
    );
  }

  if (existingPrices === 0) {
    const priceDocs = [
      ...generatePriceSeries({
        crop: "wheat",
        mandi: "pune",
        district: "pune",
        state: "maharashtra",
        basePrice: 2450,
        unit: "quintal"
      }),
      ...generatePriceSeries({
        crop: "wheat",
        mandi: "indore",
        district: "indore",
        state: "madhya pradesh",
        basePrice: 2380,
        unit: "quintal"
      }),
      ...generatePriceSeries({
        crop: "onion",
        mandi: "lasalgaon",
        district: "nashik",
        state: "maharashtra",
        basePrice: 1910,
        unit: "quintal"
      }),
      ...generatePriceSeries({
        crop: "soybean",
        mandi: "kota",
        district: "kota",
        state: "rajasthan",
        basePrice: 4480,
        unit: "quintal"
      })
    ];

    await MandiPriceModel.insertMany(priceDocs, { ordered: true });
  }
}
