export type UserRole = "farmer" | "buyer" | "admin";

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  requestId: string;
}

export interface ApiError {
  ok: false;
  code: string;
  message: string;
  requestId: string;
}

export interface HealthResponse {
  service: "api";
  status: "ok";
  ts: string;
  env: "development" | "staging" | "production" | "test";
}

export interface AuthenticatedUser {
  uid: string;
  role: UserRole;
  phoneNumber?: string;
  email?: string;
}

export interface AuthMeResponse {
  user: AuthenticatedUser;
}

export type QualityGrade = "A" | "B" | "C";
export type ListingStatus = "active" | "paused" | "sold_out" | "archived";

export interface ListingImage {
  url: string;
  width: number;
  height: number;
}

export interface Listing {
  id: string;
  farmerId: string;
  crop: string;
  qualityGrade: QualityGrade;
  quantity: number;
  unit: "kg" | "quintal" | "ton";
  pricePerUnit: number;
  harvestDate: string;
  images: ListingImage[];
  locationMeta: {
    state: string;
    district: string;
    mandi: string;
  };
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListingInput {
  crop: string;
  qualityGrade: QualityGrade;
  quantity: number;
  unit: "kg" | "quintal" | "ton";
  pricePerUnit: number;
  harvestDate: string;
  images: ListingImage[];
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  locationMeta: {
    state: string;
    district: string;
    mandi: string;
  };
}

export interface CreateListingResponse {
  listing: Listing;
}

export interface ListListingsResponse {
  listings: Listing[];
  count: number;
}

export interface ListingDetailResponse {
  listing: Listing;
}

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "countered"
  | "rejected"
  | "shipped"
  | "delivered"
  | "disputed"
  | "cancelled";

export interface PlaceOrderInput {
  listingId: string;
  qty: number;
  idempotencyKey: string;
}

export interface Order {
  id: string;
  buyerId: string;
  farmerId: string;
  listingId: string;
  status: OrderStatus;
  amountTotal: number;
  item: {
    crop: string;
    qualityGrade: QualityGrade;
    unit: "kg" | "quintal" | "ton";
    pricePerUnit: number;
    qty: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PlaceOrderResponse {
  order: Order;
}

export interface ListMyOrdersResponse {
  orders: Order[];
  count: number;
}

export interface ListMyListingsResponse {
  listings: Listing[];
  count: number;
}

export interface UpdateListingStatusInput {
  status: "paused" | "sold_out" | "archived";
}

export interface UpdateListingStatusResponse {
  listing: Listing;
}

export interface PricePoint {
  crop: string;
  mandi: string;
  state: string;
  district: string;
  unit: "kg" | "quintal" | "ton";
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  ts: string;
}

export interface PriceLatestResponse {
  price: PricePoint;
  source: "cache" | "db";
}

export interface PriceHistoryResponse {
  crop: string;
  mandi: string;
  points: PricePoint[];
}

export interface ManualIngestPriceInput {
  crop: string;
  mandi: string;
  state: string;
  district: string;
  unit: "kg" | "quintal" | "ton";
  modalPrice: number;
  minPrice: number;
  maxPrice: number;
  ts: string;
}

export interface ManualIngestPricesResponse {
  insertedCount: number;
}
