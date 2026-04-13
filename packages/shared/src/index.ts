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
