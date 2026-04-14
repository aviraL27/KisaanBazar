import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { Express } from "express";

let mongoServer: MongoMemoryReplSet;
let app: Express;
let connectMongo: () => Promise<void>;
let ListingModel: typeof import("../modules/listing/listing.model.js").ListingModel;
let OrderModel: typeof import("../modules/order/order.model.js").OrderModel;

before(async () => {
  mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = mongoServer.getUri();
  delete process.env.REDIS_URL;
  process.env.FIREBASE_AUTH_ENFORCED = "";

  ({ app } = await import("../app.js"));
  ({ connectMongo } = await import("../config/mongodb.js"));
  ({ ListingModel } = await import("../modules/listing/listing.model.js"));
  ({ OrderModel } = await import("../modules/order/order.model.js"));

  await connectMongo();
});

beforeEach(async () => {
  await Promise.all([ListingModel.deleteMany({}), OrderModel.deleteMany({})]);
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("API integration", () => {
  it("creates a listing for farmer role", async () => {
    const response = await request(app)
      .post("/v1/listings")
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "farmer")
      .send({
        crop: "wheat",
        qualityGrade: "A",
        quantity: 25,
        unit: "quintal",
        pricePerUnit: 2300,
        harvestDate: new Date("2026-03-10T00:00:00.000Z").toISOString(),
        images: [],
        location: {
          type: "Point",
          coordinates: [73.8567, 18.5204]
        },
        locationMeta: {
          state: "maharashtra",
          district: "pune",
          mandi: "pune"
        }
      });

    assert.equal(response.status, 201);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.data.listing.crop, "wheat");
    assert.equal(response.body.data.listing.status, "active");
  });

  it("places an order and decrements listing quantity", async () => {
    const createResponse = await request(app)
      .post("/v1/listings")
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "farmer")
      .send({
        crop: "soybean",
        qualityGrade: "B",
        quantity: 10,
        unit: "quintal",
        pricePerUnit: 4100,
        harvestDate: new Date("2026-03-12T00:00:00.000Z").toISOString(),
        images: [],
        location: {
          type: "Point",
          coordinates: [73.8567, 18.5204]
        },
        locationMeta: {
          state: "maharashtra",
          district: "pune",
          mandi: "pune"
        }
      });

    assert.equal(createResponse.status, 201);
    const listingId = createResponse.body.data.listing.id as string;

    const orderResponse = await request(app)
      .post("/v1/orders")
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "buyer")
      .send({
        listingId,
        qty: 3,
        idempotencyKey: randomUUID()
      });

    assert.equal(orderResponse.status, 201);
    assert.equal(orderResponse.body.ok, true);
    assert.equal(orderResponse.body.data.order.status, "placed");
    assert.equal(orderResponse.body.data.order.item.crop, "soybean");
    assert.equal(orderResponse.body.data.order.item.qty, 3);

    const updatedListing = await ListingModel.findById(listingId).exec();
    assert.ok(updatedListing);
    assert.equal(updatedListing.quantity, 7);
  });

  it("returns buyer order history for /v1/orders/mine", async () => {
    const createResponse = await request(app)
      .post("/v1/listings")
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "farmer")
      .send({
        crop: "rice",
        qualityGrade: "A",
        quantity: 20,
        unit: "quintal",
        pricePerUnit: 2800,
        harvestDate: new Date("2026-03-14T00:00:00.000Z").toISOString(),
        images: [],
        location: {
          type: "Point",
          coordinates: [73.8567, 18.5204]
        },
        locationMeta: {
          state: "maharashtra",
          district: "pune",
          mandi: "pune"
        }
      });

    const listingId = createResponse.body.data.listing.id as string;

    const firstOrder = await request(app)
      .post("/v1/orders")
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "buyer")
      .send({
        listingId,
        qty: 2,
        idempotencyKey: randomUUID()
      });

    assert.equal(firstOrder.status, 201);

    const secondOrder = await request(app)
      .post("/v1/orders")
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "buyer")
      .send({
        listingId,
        qty: 3,
        idempotencyKey: randomUUID()
      });

    assert.equal(secondOrder.status, 201);

    const mineResponse = await request(app)
      .get("/v1/orders/mine?limit=10")
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "buyer");

    assert.equal(mineResponse.status, 200);
    assert.equal(mineResponse.body.ok, true);
    assert.equal(mineResponse.body.data.count, 2);
    assert.equal(mineResponse.body.data.orders.length, 2);
    assert.equal(mineResponse.body.data.orders[0]?.id, secondOrder.body.data.order.id);
  });

  it("rejects /v1/orders/mine for non-buyer role", async () => {
    const response = await request(app)
      .get("/v1/orders/mine")
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "farmer");

    assert.equal(response.status, 403);
    assert.equal(response.body.ok, false);
    assert.equal(response.body.code, "FORBIDDEN");
  });

  it("allows farmer to update own listing status", async () => {
    const createResponse = await request(app)
      .post("/v1/listings")
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "farmer")
      .send({
        crop: "maize",
        qualityGrade: "B",
        quantity: 18,
        unit: "quintal",
        pricePerUnit: 2100,
        harvestDate: new Date("2026-03-16T00:00:00.000Z").toISOString(),
        images: [],
        location: {
          type: "Point",
          coordinates: [73.8567, 18.5204]
        },
        locationMeta: {
          state: "maharashtra",
          district: "pune",
          mandi: "pune"
        }
      });

    const listingId = createResponse.body.data.listing.id as string;

    const updateResponse = await request(app)
      .patch(`/v1/listings/${listingId}/status`)
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "farmer")
      .send({ status: "paused" });

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.body.ok, true);
    assert.equal(updateResponse.body.data.listing.status, "paused");
  });

  it("blocks farmer from updating another farmer listing and allows admin override", async () => {
    const seeded = await ListingModel.create({
      farmerId: "other-farmer",
      crop: "mustard",
      qualityGrade: "A",
      quantity: 12,
      unit: "quintal",
      pricePerUnit: 5200,
      harvestDate: new Date("2026-03-20T00:00:00.000Z"),
      images: [],
      location: {
        type: "Point",
        coordinates: [73.8567, 18.5204]
      },
      locationMeta: {
        state: "maharashtra",
        district: "pune",
        mandi: "pune"
      },
      status: "active"
    });

    const listingId = seeded._id.toString();

    const farmerUpdate = await request(app)
      .patch(`/v1/listings/${listingId}/status`)
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "farmer")
      .send({ status: "archived" });

    assert.equal(farmerUpdate.status, 403);
    assert.equal(farmerUpdate.body.ok, false);
    assert.equal(farmerUpdate.body.code, "FORBIDDEN");

    const adminUpdate = await request(app)
      .patch(`/v1/listings/${listingId}/status`)
      .set("Authorization", "Bearer dev-test-token")
      .set("x-dev-role", "admin")
      .send({ status: "archived" });

    assert.equal(adminUpdate.status, 200);
    assert.equal(adminUpdate.body.ok, true);
    assert.equal(adminUpdate.body.data.listing.status, "archived");
  });
});
