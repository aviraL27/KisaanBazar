# KisaanBazaar - System Design

## 1. Executive Summary
KisaanBazaar is designed as a marketplace plus price-intelligence platform, not only a listing portal. The architecture prioritizes:

1. Fast reads for price and listing discovery via Redis-heavy caching.
2. Strong write integrity for order placement via MongoDB transactions and idempotency keys.
3. Real-time updates for price and order events via Socket.IO and Redis Pub/Sub.
4. Eventual consistency for analytics, strict consistency for transactional order state.

### 1.1 Target Scale (V1 to V1.5)

| Metric | Target |
| --- | --- |
| Registered users | 100,000+ |
| Concurrent sessions | 10,000+ |
| Peak throughput | 5,000 req/sec |
| Mandi price ingestions | 50,000+ points/day across 500+ mandis |
| Price freshness | New data every 15 min, UI propagation within 30 sec |

### 1.2 Architecture Stance
The system uses a stateless API tier and externalized state (MongoDB + Redis), enabling horizontal scaling under traffic bursts during mandi opening hours. The design deliberately accepts bounded stale reads for price intelligence to hit latency goals, while order placement remains strongly consistent.

## 2. Technology Decisions (Opinionated)
The stack remains exactly as required, with production-stable versions for 2026.

### 2.1 Selected Versions

| Layer | Choice | Why this version |
| --- | --- | --- |
| Language | TypeScript 5.8 (strict) | Mature inference, faster project references, stable strictness for shared contracts |
| Frontend | React 19, React Router v6.30+, TanStack Query v5, Zustand v5 | Better concurrent rendering ergonomics, mature data caching semantics |
| Backend | Node.js 22 LTS, Express 5.1+ | Long support horizon and improved async error handling in Express 5 |
| Database | MongoDB 8 (compatible with 7+) + Mongoose 8 | Better operational tooling, native time-series maturity |
| Auth | Firebase Authentication | Reliable OTP-first auth with low ops burden |
| Cache/Realtime | Redis 7.4 + ioredis 5 | Stable Streams, Sorted Sets, cluster-ready behavior |
| Monorepo | Turborepo | Fast remote/local caching, straightforward TS package boundaries |

### 2.2 Monorepo Contract

| Path | Responsibility |
| --- | --- |
| packages/shared | TypeScript DTOs, event payload types, enums, validation schemas |
| apps/web | React SPA (light theme, agriculture-oriented UX) |
| apps/api | Express REST + Socket.IO + jobs |

Decision: Turborepo is selected over Nx for V1 because the team can adopt it faster with lower configuration overhead while still getting incremental builds and cache-aware pipelines.

## 3. Requirements

### 3.1 Functional Requirements by Actor

#### 3.1.1 Farmer Stories
1. Farmer can register with phone OTP and fallback email/password.
2. Farmer can create and update profile with village, district, state, land size, and primary crops.
3. Farmer can create listing with crop, quality grade, quantity, unit, ask price, harvest date, and images.
4. Farmer can edit, pause, and delete listings.
5. Farmer can view incoming orders and respond with accept/reject/counter-offer.
6. Farmer can track order life cycle and payout state.
7. Farmer can view mandi intelligence for their listed crops (7/30/90-day trends).
8. Farmer can set threshold alerts and receive price cross notifications.

#### 3.1.2 Buyer Stories
1. Buyer can register and complete KYC-lite profile for trust score.
2. Buyer can browse and filter listings by crop, geo radius, quality grade, and price band.
3. Buyer can place normal and bulk orders with delivery instructions.
4. Buyer can track status transitions (placed, confirmed, shipped, delivered, disputed).
5. Buyer can view seller rating and review history before purchase.
6. Buyer can subscribe to crop-wise price updates for selected mandis.

#### 3.1.3 Platform Stories
1. Platform ingests mandi prices from external APIs every 15 minutes.
2. Platform normalizes crop names, units, and mandi identifiers into canonical forms.
3. Platform computes trend windows (7d, 30d, 90d), volatility, and anomaly tags.
4. Platform computes region-level trending crops daily and hourly cached summaries.
5. Platform generates daily digests for farmers and buyers.

#### 3.1.4 Admin Stories
1. Admin sees GMV, active users, conversion funnel, listing quality, and anomaly counts.
2. Admin can view flagged listings/reviews and take moderation actions.
3. Admin can apply manual mandi price corrections with immutable audit trail.
4. Admin can inspect ingestion job health and data freshness SLA breaches.

### 3.2 Non-Functional Requirements and SLOs

| Property | Target | Enforcement |
| --- | --- | --- |
| Cached read latency (p95) | < 200 ms | Redis read-through cache and connection pooling |
| DB read latency (p95) | < 500 ms | Indexed queries and bounded result pagination |
| Availability | 99.9% | Multi-AZ API and DB replica set |
| Peak throughput | 5,000 req/sec | Horizontal API autoscale + Redis offload |
| Price freshness | <= 15 min source lag, <= 30 sec client propagation | Scheduled ingestion + WebSocket push |
| First meaningful paint | < 2 sec on 3G | Route splitting + CDN + critical CSS |

### 3.3 Consistency Model
1. Strong consistency: orders, inventory decrement, dispute state transitions.
2. Eventual consistency: mandi analytics, trend boards, regional ranking.
3. Bounded staleness accepted for prices: up to 15 minutes, always labeled with lastUpdatedAt.

### 3.4 Capacity and Data Estimates

| Domain | Estimate |
| --- | --- |
| Listings/day | 40,000 creates + 80,000 updates |
| Orders/day | 25,000 |
| Price reads/day | 8 to 12 million |
| Cache hit ratio target | 85% for prices, 70% for listings, 60% for search |
| WebSocket fanout | 120,000 to 250,000 events/hour at peak windows |

## 4. High-Level Architecture
Diagram file: diagrams/architecture.mmd

### 4.1 Component Boundaries
1. Client layer: React SPA using REST/JSON for request-response and WebSocket (Socket.IO events) for push updates.
2. Edge layer: AWS ALB (or Nginx) with sticky sessions for Socket.IO handshake and round-robin for REST.
3. Application layer: stateless Express pods with four planes:
	1. Auth middleware: verifies Firebase ID token and custom claims.
	2. REST modules: listing, order, price, analytics, admin.
	3. WebSocket handlers: subscriptions for price and order channels.
	4. Job workers: ingestion, trend compute, anomaly detection.
4. Cache and event layer: Redis for read cache, idempotency locks, Pub/Sub fanout, Streams event log, Sorted Set leaderboards.
5. Data layer: MongoDB replica set with a time-series collection for mandi prices.
6. External integrations: Firebase Auth, mandi APIs, and future payment/notification providers.

### 4.2 Happy Path A: Price Lookup
1. Client calls GET /prices/latest?crop=wheat&city=delhi (REST/JSON).
2. API checks Redis key kmb:price:latest:wheat:delhi (Hash).
3. Cache hit returns 200 in < 200 ms and triggers async stale check if age > 10 min.
4. Cache miss queries MongoDB mandiPrices (indexed by crop, mandi, ts desc), writes Redis with 15-min TTL, returns 200.

### 4.3 Happy Path B: Order Placement
1. Client posts order with Idempotency-Key header.
2. API acquires Redis SETNX idempotency lock.
3. API opens MongoDB transaction, decrements listing quantity, creates order, commits.
4. API invalidates listing cache and publishes order event via Redis Pub/Sub.
5. WebSocket gateway pushes order status update to buyer and farmer rooms.

### 4.4 Why This Works for V1
1. Read-heavy traffic is absorbed by Redis, reducing MongoDB pressure.
2. Stateful concerns (sessions, room fanout, idempotency, quotas) are centralized in Redis, enabling stateless API scale.
3. Order correctness is protected by transactional writes and optimistic concurrency.
4. Price intelligence latency remains low while allowing eventual consistency where business risk is low.

## 5. Low-Level Design
### 5.1 Backend Project Structure
Exact structure for apps/api/src:

```text
apps/api/src/
├── config/
│   ├── env.ts
│   ├── mongodb.ts
│   ├── redis.ts
│   └── logger.ts
├── middleware/
│   ├── auth.ts
│   ├── rateLimiter.ts
│   ├── errorHandler.ts
│   └── requestLogger.ts
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.types.ts
│   │   └── auth.validators.ts
│   ├── listing/
│   │   ├── listing.controller.ts
│   │   ├── listing.service.ts
│   │   ├── listing.routes.ts
│   │   ├── listing.model.ts
│   │   ├── listing.types.ts
│   │   └── listing.validators.ts
│   ├── order/
│   │   ├── order.controller.ts
│   │   ├── order.service.ts
│   │   ├── order.routes.ts
│   │   ├── order.model.ts
│   │   ├── order.types.ts
│   │   └── order.validators.ts
│   ├── price/
│   │   ├── price.controller.ts
│   │   ├── price.query.service.ts
│   │   ├── price.ingestion.service.ts
│   │   ├── price.routes.ts
│   │   ├── mandiPrice.model.ts
│   │   ├── priceSnapshot.model.ts
│   │   └── price.types.ts
│   └── analytics/
│       ├── analytics.controller.ts
│       ├── analytics.service.ts
│       ├── analytics.routes.ts
│       └── analytics.types.ts
├── shared/
│   ├── dto/
│   ├── errors/
│   ├── http/
│   └── constants/
├── cache/
│   ├── keys.ts
│   ├── redisClient.ts
│   ├── cacheService.ts
│   └── cacheInvalidation.ts
├── jobs/
│   ├── queues.ts
│   ├── priceIngestion.job.ts
│   ├── trendComputation.job.ts
│   └── digest.job.ts
├── ws/
│   ├── socketServer.ts
│   ├── events.ts
│   ├── rooms.ts
│   └── handlers/
│       ├── price.handler.ts
│       └── order.handler.ts
├── app.ts
└── server.ts
```

Decision: feature-based modules are mandatory because team growth happens by business capability (listing, order, price), not by technical layer.

Why this scales better than layer-based:
1. Change locality: one feature change touches one module instead of controller/service/model folders spread across codebase.
2. Ownership model: each squad owns one module end-to-end, reducing merge conflicts.
3. Better deploy safety: feature-specific tests and metrics are co-located.
4. Easier deprecation: retiring a feature means deleting one module tree with minimal collateral.
5. Reduced circular dependencies: module public interfaces are explicit.

### 5.2 MongoDB Design

#### 5.2.1 Shared TypeScript Enums

```ts
export type UserRole = "farmer" | "buyer" | "admin";
export type ListingStatus = "active" | "paused" | "sold_out" | "archived";
export type OrderStatus =
	| "placed"
	| "confirmed"
	| "countered"
	| "rejected"
	| "shipped"
	| "delivered"
	| "disputed"
	| "cancelled";
export type QualityGrade = "A" | "B" | "C";
```

#### 5.2.2 users Collection

```ts
export interface UserDoc {
	_id: string; // firebase uid
	role: UserRole;
	fullName: string;
	phoneEnc?: string; // encrypted field
	email?: string;
	profileImageUrl?: string;
	location: {
		state: string;
		district: string;
		village?: string;
		geo?: { type: "Point"; coordinates: [number, number] };
	};
	farmerProfile?: {
		landSizeAcres?: number;
		primaryCrops: string[];
	};
	buyerProfile?: {
		businessName?: string;
		preferredCrops: string[];
	};
	trustScore: number;
	createdAt: Date;
	updatedAt: Date;
}
```

Indexes:
1. { role: 1, "location.state": 1, "location.district": 1 } for regional user segmentation.
2. { trustScore: -1 } for admin trust ranking.
3. 2dsphere on location.geo for nearby listing queries tied to user location.

Access patterns optimized:
1. Load user profile by Firebase uid.
2. Filter farmers by region for digests and campaigns.
3. Fetch high trust sellers quickly.

Size and growth:
1. Approx document size: 1.2 KB.
2. 100K users -> ~120 MB raw, ~250 MB including indexes and overhead.

#### 5.2.3 listings Collection

```ts
export interface ListingImage {
	url: string;
	width: number;
	height: number;
}

export interface ListingDoc {
	_id: string;
	farmerId: string;
	crop: string;
	qualityGrade: QualityGrade;
	quantity: number;
	unit: "kg" | "quintal" | "ton";
	pricePerUnit: number;
	harvestDate: Date;
	images: ListingImage[];
	location: { type: "Point"; coordinates: [number, number] };
	locationMeta: { state: string; district: string; mandi: string };
	status: ListingStatus;
	version: number;
	createdAt: Date;
	updatedAt: Date;
}
```

Indexes:
1. { crop: 1, status: 1, pricePerUnit: 1 } for primary marketplace filtering.
2. { farmerId: 1, createdAt: -1 } for farmer dashboard listing management.
3. 2dsphere on location for geo search.
4. Partial index { status: 1, updatedAt: -1 } with filter status=active to optimize active feed only.

Access patterns optimized:
1. Buyer search and filter by crop, region, price.
2. Farmer CRUD and listing status management.
3. Inventory validation in order placement.

Size and growth:
1. Approx document size: 2.0 KB (3-5 image metadata entries).
2. 40K new listings/day -> 14.6M/year -> ~29 GB raw/year.

#### 5.2.4 orders Collection

```ts
export interface OrderItemSnapshot {
	listingId: string;
	crop: string;
	qualityGrade: QualityGrade;
	unit: "kg" | "quintal" | "ton";
	pricePerUnit: number;
	qty: number;
}

export interface OrderDoc {
	_id: string;
	idempotencyKey: string;
	buyerId: string;
	farmerId: string;
	listingId: string;
	item: OrderItemSnapshot;
	status: OrderStatus;
	amountTotal: number;
	counterOffer?: { pricePerUnit: number; qty: number; createdAt: Date };
	history: Array<{ from: OrderStatus; to: OrderStatus; at: Date; by: string }>;
	createdAt: Date;
	updatedAt: Date;
}
```

Indexes:
1. Unique { idempotencyKey: 1 } as final defense against duplicate order creation.
2. { buyerId: 1, createdAt: -1 } for buyer order history.
3. { farmerId: 1, status: 1, createdAt: -1 } for farmer action queue.
4. { listingId: 1, createdAt: -1 } for listing-level order analytics.

Access patterns optimized:
1. Place order with conflict-safe duplicate prevention.
2. Filter actionable orders by farmer and status.
3. Customer support lookup by order id and transitions.

Size and growth:
1. Approx document size: 1.8 KB average.
2. 25K/day -> 9.1M/year -> ~16 GB raw/year.

Embedding vs referencing decision for order items:
1. Embed immutable item snapshot in order.item for historical correctness at purchase time.
2. Keep listingId reference to join back for audits and moderation.
3. This hybrid avoids broken history if listing changes after purchase.

#### 5.2.5 mandiPrices Collection (Time-Series)

```ts
export interface MandiPriceDoc {
	_id: string;
	ts: Date; // timeField
	meta: {
		crop: string;
		mandiCode: string;
		mandiName: string;
		state: string;
		district: string;
		unit: "kg" | "quintal" | "ton";
		source: "agmarknet" | "data_gov" | "manual_correction";
	};
	minPrice: number;
	maxPrice: number;
	modalPrice: number;
	normalizedPricePerQuintal: number;
	ingestionBatchId: string;
	qualityFlags: string[];
	createdAt: Date;
}
```

Collection decision: use native MongoDB time-series with timeField=ts and metaField=meta.

Indexes:
1. { "meta.crop": 1, "meta.mandiCode": 1, ts: -1 } for latest price lookup.
2. { "meta.state": 1, "meta.district": 1, "meta.crop": 1, ts: -1 } for regional trend APIs.
3. TTL-style archival policy at collection level for hot retention window (365 days in primary cluster).

Access patterns optimized:
1. Latest price by crop+mandi.
2. Historical trends by crop and region over fixed windows.
3. Batch ingestion and anomaly scans by recent horizon.

Size and growth:
1. Approx doc size: 280 bytes compressed effective in time-series buckets.
2. 50K/day -> 18.25M/year -> ~5.1 GB compressed/year (excluding indexes).

Time-series vs regular collection decision:
1. Time-series is selected for better storage compression and query efficiency for temporal scans.
2. Regular collection is rejected due to higher storage and index overhead at this ingestion frequency.

#### 5.2.6 priceSnapshots Collection

```ts
export interface PriceSnapshotDoc {
	_id: string;
	date: string; // YYYY-MM-DD
	region: { state: string; district?: string };
	crop: string;
	avgPricePerQuintal: number;
	trend7dPct: number;
	trend30dPct: number;
	trend90dPct: number;
	volatility: number;
	anomalyScore: number;
	generatedAt: Date;
}
```

Indexes:
1. Unique { date: 1, "region.state": 1, "region.district": 1, crop: 1 } for deterministic daily upsert.
2. { crop: 1, generatedAt: -1 } for latest trend cards.
3. { "region.state": 1, anomalyScore: -1 } for anomaly dashboard.

Access patterns optimized:
1. Daily trend card APIs.
2. Regional anomaly exploration.
3. Digest generation jobs.

Size and growth:
1. Approx doc size: 420 bytes.
2. 500 mandis x 60 crops/day snapshot rollups -> 30K/day worst case -> ~12.6 MB/day raw.

#### 5.2.7 reviews Collection

```ts
export interface ReviewDoc {
	_id: string;
	orderId: string;
	listingId: string;
	buyerId: string;
	farmerId: string;
	rating: 1 | 2 | 3 | 4 | 5;
	comment?: string;
	tags: string[];
	createdAt: Date;
	updatedAt: Date;
}
```

Indexes:
1. Unique { orderId: 1 } to enforce one review per completed order.
2. { farmerId: 1, createdAt: -1 } for seller profile reviews.
3. Text index on comment for moderation and abuse search.

Access patterns optimized:
1. Seller trust score computation.
2. Recent reviews in listing and profile pages.
3. Moderation keyword scan.

Size and growth:
1. Approx doc size: 700 bytes average.
2. If 35% of orders reviewed: 8.7K/day -> 3.2M/year -> ~2.2 GB/year raw.

#### 5.2.8 Archival Strategy for Prices Older Than 1 Year
1. Keep last 365 days in primary MongoDB cluster for low-latency APIs.
2. Nightly archival job exports >365-day buckets to object storage (Parquet) for low-cost retention.
3. Delete archived docs from primary to preserve index performance.
4. Rehydrate historical ranges on-demand into analytics warehouse, not transactional DB.

### 5.3 Redis Design

#### 5.3.1 Key Convention
All keys follow: kmb:{domain}:{entity}:{id}

Examples:
1. kmb:price:latest:wheat:delhi
2. kmb:listing:detail:lst_abc123
3. kmb:trending:crops:in_haryana
4. kmb:order:idempotency:uuid_v4

#### 5.3.2 Cached Data and Structures

| Data | Redis structure | Key example | TTL |
| --- | --- | --- | --- |
| Latest mandi price | Hash | kmb:price:latest:wheat:delhi | 15 min |
| Listing detail | String (JSON) | kmb:listing:detail:lst_abc123 | 5 min |
| Trending crops | Sorted Set | kmb:trending:crops:in_haryana | 1 hour |
| Search result page | String (JSON) | kmb:search:listings:qhash123 | 1 min |
| Rate limiting | Sorted Set per user+route | kmb:ratelimit:user123:/orders | 60 sec window |
| Idempotency lock | String | kmb:order:idempotency:uuid_v4 | 5 min |
| Price event log | Stream | kmb:stream:price:events | retention by maxlen |
| Unique visitors | HyperLogLog | kmb:analytics:uv:2026-04-13 | 24 hours rollup |

#### 5.3.3 TTL Policy Rationale
1. Prices 15 min because ingestion cadence is 15 min and stale data remains business-acceptable.
2. Listings 5 min to reduce stale inventory risk while still protecting DB from read spikes.
3. Search 1 min because query combinations are high-cardinality and quickly volatile.
4. Trends 1 hour because computation is scheduled and not transaction-critical.

#### 5.3.4 Exact Redis Commands (Core Operations)

Set latest price hash:

```ts
await redis.hset("kmb:price:latest:wheat:delhi", {
	crop: "wheat",
	mandi: "delhi",
	modalPrice: "2420",
	unit: "quintal",
	ts: "2026-04-13T10:15:00.000Z"
});
await redis.expire("kmb:price:latest:wheat:delhi", 900);
```

Update regional trending leaderboard:

```ts
await redis.zadd("kmb:trending:crops:in_haryana", [
	{ score: 92.4, value: "wheat" },
	{ score: 88.1, value: "mustard" }
]);
await redis.expire("kmb:trending:crops:in_haryana", 3600);
```

Append anomaly event to stream:

```ts
await redis.xadd(
	"kmb:stream:price:events",
	"MAXLEN",
	"~",
	100000,
	"*",
	"eventType",
	"price.anomaly.detected",
	"crop",
	"wheat",
	"mandi",
	"delhi",
	"deltaPct",
	"12.7",
	"ts",
	new Date().toISOString()
);
```

Idempotency lock for order creation:

```ts
const ok = await redis.set(
	"kmb:order:idempotency:8f85cbf4-6f5f-4db2-9d4c-f2f1b9de3f76",
	"pending",
	"EX",
	300,
	"NX"
);
```

Rate limiting sliding window using sorted sets:

```ts
const key = "kmb:ratelimit:user_123:/orders";
const now = Date.now();
const min = now - 60_000;
await redis.zremrangebyscore(key, 0, min);
await redis.zadd(key, [{ score: now, value: `${now}` }]);
const count = await redis.zcard(key);
await redis.expire(key, 61);
```

## 6. Critical Path Data Flows
### 6.1 Fetching mandi prices
Diagram: diagrams/flow-1-fetch-prices.mmd

Step-by-step:
1. Client requests GET /v1/prices/latest?crop=wheat&city=delhi.
2. API validates query; invalid crop/city returns 400.
3. Redis read: HGETALL kmb:price:latest:wheat:delhi.
4. Cache hit path:
1. If key exists and now-ts <= 900 sec, return 200 with source=cache and ageSec.
2. If ageSec > 600 and <= 900, return 200 immediately and trigger async revalidate.
5. Cache miss path:
1. Mongo query:

```ts
db.mandiPrices
	.find({ "meta.crop": "wheat", "meta.mandiName": "delhi" })
	.sort({ ts: -1 })
	.limit(1)
```

2. If no doc, return 404 with code PRICE_NOT_FOUND.
3. On doc found, write Redis hash and EXPIRE 900.
4. Return 200 with source=db.

Failure handling by step:
1. Query validation failure: 400; metric prices.validation_error++.
2. Redis unavailable: log warn, bypass cache, query Mongo directly, return 200 source=db_fallback.
3. Mongo timeout: return 503 with retryAfterSec=3 and cached stale fallback if available.
4. Redis set failure after DB hit: still return 200, emit cache_write_error metric.

### 6.2 Adding a new listing
Diagram: diagrams/flow-2-add-listing.mmd

Step-by-step:
1. Farmer calls POST /v1/listings with Authorization and JSON payload.
2. Middleware verifies Firebase token and role=farmer; unauthorized returns 401 or 403.
3. Zod validates payload (crop, quantity, price, harvestDate, images, geo); invalid returns 422.
4. Mongo insertOne into listings with status=active and version=1.
5. Invalidate caches:
1. DEL kmb:listing:detail:{listingId}
2. DEL regional category/search tag keys for state and district.
3. Publish cache invalidation event for search indexers.
6. Publish Redis Pub/Sub event listing.created to channel kmb:pubsub:listings.
7. WebSocket server emits listing:created to buyers subscribed to crop-region room.
8. Return 201 with listingId.

Mongo insert shape:

```ts
db.listings.insertOne({
	farmerId,
	crop,
	qualityGrade,
	quantity,
	unit,
	pricePerUnit,
	harvestDate,
	images,
	location,
	locationMeta,
	status: "active",
	version: 1,
	createdAt: new Date(),
	updatedAt: new Date()
});
```

Failure handling by step:
1. Auth failure: 401 or 403.
2. Validation failure: 422 with field-level errors.
3. Insert failure: 503 and retry token.
4. Cache invalidation failure: return 201 but emit stale-feed alert.
5. Pub/Sub failure: return 201 and enqueue deferred broadcast job.

### 6.3 Buyer placing an order
Diagram: diagrams/flow-3-place-order.mmd

Step-by-step:
1. Buyer calls POST /v1/orders with header Idempotency-Key: uuid.
2. API checks Redis lock:

```ts
SET kmb:order:idempotency:{uuid} pending EX 300 NX
```

3. If SET returns null, return 409 DUPLICATE_REQUEST.
4. Read listing for availability and version:

```ts
db.listings.findOne(
	{ _id: listingId, status: "active" },
	{ quantity: 1, version: 1, farmerId: 1, pricePerUnit: 1, crop: 1, qualityGrade: 1, unit: 1 }
)
```

5. If quantity < requestedQty, return 409 INSUFFICIENT_QUANTITY.
6. Start Mongo transaction.
7. Conditional decrement using optimistic concurrency:

```ts
db.listings.updateOne(
	{ _id: listingId, version: expectedVersion, quantity: { $gte: requestedQty } },
	{ $inc: { quantity: -requestedQty, version: 1 }, $set: { updatedAt: new Date() } },
	{ session }
)
```

8. Insert order document with item snapshot and status=placed in same session.
9. Commit transaction.
10. Cache invalidation and eventing:
1. DEL kmb:listing:detail:{listingId}
2. PUBLISH kmb:pubsub:orders order.created payload
11. Set idempotency key value to committed:{orderId} with TTL 24h for replay safety.
12. Return 201 with order summary.

Failure handling by step:
1. Missing idempotency key: 400.
2. Lock collision: 409 duplicate request.
3. Listing not found or not active: 404.
4. Quantity/version conflict during updateOne: abort transaction, return 409.
5. Transaction commit failure: abort and return 503.
6. Redis publish failure after commit: return 201 and enqueue outbox replay record.

### 6.4 Price ingestion pipeline
Diagram: diagrams/flow-4-price-ingestion.mmd

Step-by-step:
1. Cron triggers every 15 minutes and acquires Redlock key kmb:lock:ingestion:prices with TTL 10 min.
2. Worker fetches external API payloads for configured mandis.
3. Normalize names, units, mandi codes; validate with Zod.
4. Bulk write into mandiPrices time-series collection with ordered=false.
5. Update Redis latest hashes kmb:price:latest:{crop}:{city} for each affected pair.
6. Compute delta against previous snapshots and anomaly score.
7. If anomaly threshold crossed, XADD event into kmb:stream:price:events.
8. Broadcast high-priority anomalies through WebSocket channels.
9. Upsert daily and regional aggregate into priceSnapshots.
10. Release lock and publish job metrics.

Mongo bulk write pattern:

```ts
db.mandiPrices.bulkWrite(
	docs.map((d) => ({ insertOne: { document: d } })),
	{ ordered: false }
);
```

Failure handling by step:
1. Lock not acquired: another worker active, exit gracefully.
2. External API timeout: exponential backoff for 3 attempts, then mark source degraded.
3. Validation failures: drop bad rows and write dead-letter records.
4. Partial bulk write failures: capture failed ids and continue.
5. Redis update failures: do not block ingestion commit.
6. Snapshot upsert failure: enqueue recompute job.

### 6.5 Trending crops computation
Diagram: diagrams/flow-5-trending-crops.mmd

Step-by-step:
1. Scheduler runs hourly per region.
2. Aggregate order velocity and price momentum from MongoDB.

```ts
db.orders.aggregate([...]);
db.priceSnapshots.aggregate([...]);
```

3. Compute composite score:

$$
score = 0.6 \cdot z(orderVolume24h) + 0.3 \cdot z(priceVelocity7d) + 0.1 \cdot z(reviewSentiment)
$$

4. Write sorted set and TTL:

```ts
ZADD kmb:trending:crops:{region} score crop
EXPIRE kmb:trending:crops:{region} 3600
```

5. Frontend fetches via ZREVRANGE and API returns 200 with rank and score.

Failure handling by step:
1. Aggregation timeout: return previous cached leaderboard with stale=true.
2. ZADD failure: retain previous key until next run.
3. Missing regional data: return 200 with empty list and reason=no_data.

## 7. Redis Deep Dive

### 7.1 Why Redis (Quantified)
Without Redis, price reads hit MongoDB at roughly 5-20 ms query time. With Redis hash reads, server time is typically < 1 ms.

At 5,000 req/sec peak and 85% cache hit:
1. Redis requests: 4,250 req/sec.
2. Mongo requests from misses: 750 req/sec.
3. With 8 ms average Mongo query time, required active concurrency is:

$$
concurrency \approx qps \times latency = 750 \times 0.008 = 6
$$

Without Redis at 5,000 req/sec:

$$
concurrency \approx 5000 \times 0.008 = 40
$$

This keeps Mongo capacity focused on writes and transactions.

### 7.2 What Breaks Without Redis
1. Real-time broadcast degrades to polling and poor UX.
2. Rate limiting becomes inconsistent across API replicas.
3. Trending endpoint becomes repeated heavy aggregation.
4. Idempotency moves to DB and adds latency to order checkout.

### 7.3 Consistency and Performance Tradeoffs
1. Prices can be stale within a 15-minute bounded window.
2. Order status writes require strict consistency.
3. Listing reads tolerate short staleness, writes use optimistic locking.
4. Search results allow 60-second staleness.

### 7.4 Cache Invalidation Strategy
1. TTL-based expiry for prices, search, trends.
2. Event-driven invalidation for listing CRUD and order updates.
3. Write-through for order status summary keys.
4. Stale-while-revalidate for price keys older than 10 minutes.

### 7.5 Redis Failure Handling
1. Circuit breaker opens after 3 consecutive health-check failures.
2. Degraded mode:
1. Serve from MongoDB directly.
2. Disable app-level rate limiting and rely on edge limits.
3. Freeze trending endpoint to static fallback.
4. Log misses and replay cache warm-up on recovery.

## 8. Scaling Strategy
Diagram: diagrams/scaling-topology.mmd

| Component | Trigger | Scale Method | Gotchas |
| --- | --- | --- | --- |
| Express API | CPU > 70% for 5 min or p95 > 250 ms | Horizontal autoscale behind ALB | Graceful shutdown must drain active sockets |
| WebSocket tier | >20K sockets per instance | Independent scale with socket.io redis adapter | Sticky handshake and room rebalance |
| MongoDB | Primary CPU > 65% or mandiPrices >100M docs | Replica set then sharding by {meta.crop, meta.mandiCode} | Wrong shard key causes hotspots |
| Redis | Memory > 70% or CPU > 60% | Redis Cluster 3 masters + 3 replicas | Hot keys and cross-slot operations |
| Ingestion worker | Job lag > 2 cycles | Scale worker pool with one Redlock leader | Duplicate writes if lock misconfigured |

## 9. Edge Cases and Failure Handling

### 9.1 Redis Goes Down Entirely
1. Detection: ping failures and ioredis timeout spike.
2. Impact: cache misses and reduced real-time features.
3. Mitigation: Mongo fallback and static trending fallback.
4. Recovery: warm hot keys and replay deferred events.

### 9.2 MongoDB Primary Failover
1. Detection: transient transaction errors and not-primary errors.
2. Impact: in-flight writes abort.
3. Mitigation: retry with idempotency key and jitter.
4. Recovery: driver reconnect to new primary.

### 9.3 Duplicate Order Placement
1. Detection: Redis NX fail or DB unique index conflict.
2. Impact: risk of duplicate order.
3. Mitigation: return existing order for same key.
4. Recovery: reconciliation scan for anomalies.

### 9.4 Stale Listing Cache
1. Detection: quantity compare-and-swap conflict.
2. Impact: buyer sees temporarily stale quantity.
3. Mitigation: return 409 SOLD_OUT and refresh listing key.
4. Recovery: UI refresh and substitute suggestions.

### 9.5 Price Ingestion API Down
1. Detection: repeated upstream timeout or 5xx.
2. Impact: stale prices.
3. Mitigation: serve last known price with stale flag.
4. Recovery: exponential backoff and provider failover.

### 9.6 Thundering Herd on Cache Miss
1. Detection: miss burst for same key and query amplification.
2. Impact: DB hotspot and latency spike.
3. Mitigation: rebuild lock via SET NX EX.
4. Recovery: one request rebuilds, others retry with jitter.

### 9.7 Hot Key in Redis
1. Detection: key-level command concentration from stats.
2. Impact: tail latency and CPU concentration.
3. Mitigation: local L1 LRU cache with 30-second TTL.
4. Recovery: shard logical key by region when possible.

## 10. Security Architecture
Diagram: diagrams/auth-flow.mmd

### 10.1 Auth Flow
1. Client authenticates with Firebase OTP and gets idToken.
2. Client sends Bearer token to API.
3. Middleware verifies token using Firebase Admin SDK.
4. uid and role claims are attached to req.user.
5. Route middleware and service checks enforce RBAC.

### 10.2 API Protection
1. Only public price read endpoints bypass auth.
2. All other routes require auth middleware.
3. RBAC roles: farmer, buyer, admin.
4. Zod validation on every endpoint with typed error contracts.
5. Helmet, CORS allow-list, and body size limits enabled.

### 10.3 Redis-backed Rate Limiting
Sliding window via Sorted Sets.

Tiers:
1. Anonymous 20 req/min.
2. Authenticated 100 req/min.
3. Premium 500 req/min.

Sensitive override:
1. POST /v1/orders limited to 5 req/min per user.

### 10.4 Data Security
1. No PII values in Redis.
2. Field-level encryption for phone numbers in MongoDB.
3. API responses omit internal stack traces and internals.
4. Admin actions are audit logged.

## 11. Advanced Feature Hooks

### 11.1 Price Prediction (ML)
Pipeline:
1. Export mandiPrices to object storage daily.
2. Python ML service produces 7-day forecasts.
3. Write to pricePredictions collection.
4. API serves forecast with actuals and caches 6 hours.

Schema:

```ts
export interface PricePredictionDoc {
	_id: string;
	crop: string;
	mandiCode: string;
	region: { state: string; district: string };
	modelVersion: string;
	generatedAt: Date;
	horizonDays: 7;
	points: Array<{
		date: string;
		predictedPricePerQuintal: number;
		lower95: number;
		upper95: number;
	}>;
}
```

### 11.2 Notifications (Multi-channel)
Use Redis Streams as event bus and worker-based dispatch.

Preference schema:

```ts
export interface NotificationPreferenceDoc {
	_id: string;
	userId: string;
	channels: {
		push: { enabled: boolean };
		sms: { enabled: boolean };
		inApp: { enabled: boolean };
	};
	frequency: {
		priceAlerts: "instant" | "hourly_digest" | "daily_digest";
		orderUpdates: "instant";
	};
	quietHours?: { start: string; end: string; tz: string };
	updatedAt: Date;
}
```

Event payload:

```ts
export interface NotificationEvent {
	eventId: string;
	eventType: "price.threshold.crossed" | "order.status.changed" | "listing.interest.spike";
	userId: string;
	channelsAllowed: Array<"push" | "sms" | "in_app">;
	dedupeKey: string;
	payload: Record<string, string | number | boolean>;
	createdAt: string;
}
```

### 11.3 Offline-first Sync
Conflict policy:
1. Listing drafts: last-write-wins.
2. Prices: server-wins.

Protocol:

```ts
export interface SyncRequest {
	userId: string;
	lastSyncTimestamp: string;
	drafts: Array<{ clientId: string; type: "listingDraft"; updatedAt: string; payload: unknown }>;
}

export interface SyncResponse {
	serverTimestamp: string;
	deltas: {
		listings: Array<{ id: string; op: "upsert" | "delete"; updatedAt: string; data?: unknown }>;
		prices: Array<{ crop: string; mandi: string; ts: string; modalPrice: number }>;
	};
	conflicts: Array<{ clientId: string; resolution: "client_wins" | "server_wins"; reason: string }>;
}
```

### 11.4 Multi-language Support
1. Translation keys use feature.section.element format.
2. API can return localized labels using translation key plus default text.

```ts
export interface LocalizedText {
	key: string;
	defaultText: string;
	params?: Record<string, string | number>;
}
```

## 12. Frontend UX Direction (V1)
1. Light theme optimized for daylight usage.
2. Agriculture palette with calm greens, earthy browns, and grain gold accents.
3. Minimal motion and high-contrast typography.
4. Every price card shows freshness timestamp and stale status.
5. Mobile-first layout for low-bandwidth devices.

## 13. Production Operations

### 13.1 Deployment Topology
1. Containerized 3-tier deployment: web, app, data.
2. Separate pods for API, WebSocket, and worker workloads.
3. Blue-green releases for API and canary rollout for risky changes.

### 13.2 Monitoring Hooks
1. API p95 and p99 latency by route.
2. Redis hit rate by keyspace.
3. Mongo query latency and slow query counts.
4. WebSocket connection count and event lag.
5. Ingestion success rate and freshness lag.

### 13.3 Logging Strategy
1. Structured JSON logs with requestId and traceId.
2. Redaction of sensitive fields by default.
3. Correlated logs across API, workers, and sockets.

Typed log event:

```ts
export interface ApiLogEvent {
	ts: string;
	level: "info" | "warn" | "error";
	service: "api" | "worker" | "ws";
	route: string;
	requestId: string;
	traceId: string;
	userIdHash?: string;
	statusCode: number;
	latencyMs: number;
}
```

## 14. Risks and Tradeoffs
1. Redis dependency improves latency but increases operational coupling.
2. Eventual consistency in analytics can create short-lived display mismatches.
3. Archival and analytics backfill increase pipeline complexity.

Revisit triggers:
1. Add payment gateway integration once GMV and dispute volume justify it.
2. Add dedicated analytics warehouse when reporting load starts impacting transactional workloads.

## 9. Edge Cases and Failure Handling
- Detection, impact, mitigation, recovery for 7 scenarios.

## 10. Security Architecture
- Auth flow and token verification.
- RBAC, validation, transport security, rate limiting.
- Diagram: diagrams/auth-flow.mmd

## 11. Advanced Feature Hooks
- Price prediction pipeline and schema contract.
- Notifications event architecture and payload contract.
- Offline sync protocol.
- i18n strategy and API payload format.

## 12. Frontend UX Direction (V1)
- Light theme.
- Agriculture-centric visual language.
- Minimal, practical UI behavior.

## 13. Production Operations
- Metrics, traces, logs, alerts, SLO dashboards.
- Deployment topology (containerized 3-tier).
- Release strategy and rollback.

## 14. Risks and Tradeoffs
- Known constraints.
- Deferred decisions and how to revisit.
