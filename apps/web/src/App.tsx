import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import type {
  CreateListingInput,
  CreateListingResponse,
  ListListingsResponse,
  PlaceOrderInput,
  PlaceOrderResponse,
  PriceHistoryResponse,
  PriceLatestResponse,
  UserRole
} from "@kisaanbazar/shared";
import { apiGet, apiPost, type ApiRequestOptions } from "./lib/api";

interface DevSession {
  token: string;
  role: UserRole;
}

const sessionStorageKey = "kisaanbazar-dev-session";

function readSession(): DevSession {
  const fallback: DevSession = { token: "dev-token", role: "buyer" };
  const raw = window.localStorage.getItem(sessionStorageKey);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DevSession>;
    if (
      typeof parsed.token === "string" &&
      (parsed.role === "buyer" || parsed.role === "farmer" || parsed.role === "admin")
    ) {
      return { token: parsed.token, role: parsed.role };
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function writeSession(session: DevSession): void {
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

function SessionBar(props: { session: DevSession; onChange: (next: DevSession) => void }) {
  const { session, onChange } = props;

  return (
    <div className="session-bar">
      <label>
        Bearer token
        <input
          value={session.token}
          onChange={(event) => onChange({ ...session, token: event.target.value })}
          placeholder="required for protected endpoints"
        />
      </label>
      <label>
        Dev role
        <select
          value={session.role}
          onChange={(event) => onChange({ ...session, role: event.target.value as UserRole })}
        >
          <option value="buyer">buyer</option>
          <option value="farmer">farmer</option>
          <option value="admin">admin</option>
        </select>
      </label>
    </div>
  );
}

function HomePage() {
  return (
    <main className="page">
      <section className="hero hero-home">
        <p className="eyebrow">KisaanBazaar</p>
        <h1>Market intelligence for every mandi decision</h1>
        <p className="subtitle">
          Explore active listings, compare mandi pricing, and move from discovery to order with a single workflow.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" to="/marketplace">Open marketplace</Link>
          <Link className="btn btn-secondary" to="/prices">View mandi prices</Link>
        </div>
      </section>
    </main>
  );
}

function MarketplacePage(props: { auth: ApiRequestOptions }) {
  const { auth } = props;
  const [crop, setCrop] = useState("");
  const [state, setState] = useState("");
  const [limit, setLimit] = useState(12);
  const [qtyByListing, setQtyByListing] = useState<Record<string, number>>({});
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["listings", crop, state, limit],
    queryFn: async () => {
      return apiGet<ListListingsResponse>("/v1/listings", {
        crop: crop || undefined,
        state: state || undefined,
        limit
      });
    }
  });

  const orderMutation = useMutation({
    mutationFn: async (input: PlaceOrderInput) => apiPost<PlaceOrderResponse, PlaceOrderInput>("/v1/orders", input, auth),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
    }
  });

  return (
    <main className="page">
      <section className="hero compact">
        <p className="eyebrow">Marketplace</p>
        <h1>Active crop listings</h1>
        <p className="subtitle">Filter by crop and state to discover current market supply.</p>
      </section>

      <section className="filters card">
        <label>
          Crop
          <input value={crop} onChange={(event) => setCrop(event.target.value)} placeholder="e.g. wheat" />
        </label>
        <label>
          State
          <input value={state} onChange={(event) => setState(event.target.value)} placeholder="e.g. maharashtra" />
        </label>
        <label>
          Limit
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={50}>50</option>
          </select>
        </label>
      </section>

      {query.isLoading && <p className="status">Loading listings...</p>}
      {query.isError && <p className="status error">{(query.error as Error).message}</p>}

      {query.data && (
        <section className="grid listings-grid">
          {query.data.listings.map((listing) => (
            <article className="card listing-card" key={listing.id}>
              <div className="card-head">
                <h2>{listing.crop}</h2>
                <span className="badge">Grade {listing.qualityGrade}</span>
              </div>
              <p>
                {listing.quantity} {listing.unit} at Rs.{listing.pricePerUnit}/{listing.unit}
              </p>
              <p className="muted">
                {listing.locationMeta.mandi}, {listing.locationMeta.district}, {listing.locationMeta.state}
              </p>
              <div className="order-actions">
                <input
                  type="number"
                  min={1}
                  max={listing.quantity}
                  value={qtyByListing[listing.id] ?? 1}
                  onChange={(event) => {
                    const nextQty = Number(event.target.value);
                    setQtyByListing((prev) => ({ ...prev, [listing.id]: Number.isFinite(nextQty) ? nextQty : 1 }));
                  }}
                />
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => {
                    const qty = Math.max(1, Math.min(listing.quantity, qtyByListing[listing.id] ?? 1));
                    orderMutation.mutate({
                      listingId: listing.id,
                      qty,
                      idempotencyKey: crypto.randomUUID()
                    });
                  }}
                  disabled={orderMutation.isPending}
                >
                  Place order
                </button>
              </div>
            </article>
          ))}
          {query.data.count === 0 && <p className="status">No listings found for current filters.</p>}
        </section>
      )}

      {orderMutation.isError && <p className="status error">{(orderMutation.error as Error).message}</p>}
      {orderMutation.isSuccess && <p className="status">Order placed successfully.</p>}
    </main>
  );
}

function SellPage(props: { auth: ApiRequestOptions }) {
  const { auth } = props;
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    crop: "wheat",
    qualityGrade: "A" as "A" | "B" | "C",
    quantity: 20,
    unit: "quintal" as "kg" | "quintal" | "ton",
    pricePerUnit: 2400,
    harvestDate: new Date().toISOString().slice(0, 10),
    state: "maharashtra",
    district: "pune",
    mandi: "pune",
    latitude: 18.5204,
    longitude: 73.8567
  });

  const mutation = useMutation({
    mutationFn: async (payload: CreateListingInput) => apiPost<CreateListingResponse, CreateListingInput>("/v1/listings", payload, auth),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
    }
  });

  return (
    <main className="page">
      <section className="hero compact">
        <p className="eyebrow">Farmer Desk</p>
        <h1>Create a listing</h1>
        <p className="subtitle">Set role to farmer or admin in the top bar for local development.</p>
      </section>

      <form
        className="card sell-form"
        onSubmit={(event) => {
          event.preventDefault();
          const payload: CreateListingInput = {
            crop: form.crop,
            qualityGrade: form.qualityGrade,
            quantity: form.quantity,
            unit: form.unit,
            pricePerUnit: form.pricePerUnit,
            harvestDate: new Date(`${form.harvestDate}T00:00:00.000Z`).toISOString(),
            images: [],
            location: {
              type: "Point",
              coordinates: [form.longitude, form.latitude]
            },
            locationMeta: {
              state: form.state,
              district: form.district,
              mandi: form.mandi
            }
          };

          mutation.mutate(payload);
        }}
      >
        <label>
          Crop
          <input value={form.crop} onChange={(event) => setForm({ ...form, crop: event.target.value })} />
        </label>
        <label>
          Grade
          <select
            value={form.qualityGrade}
            onChange={(event) => setForm({ ...form, qualityGrade: event.target.value as "A" | "B" | "C" })}
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </label>
        <label>
          Quantity
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
          />
        </label>
        <label>
          Unit
          <select
            value={form.unit}
            onChange={(event) => setForm({ ...form, unit: event.target.value as "kg" | "quintal" | "ton" })}
          >
            <option value="kg">kg</option>
            <option value="quintal">quintal</option>
            <option value="ton">ton</option>
          </select>
        </label>
        <label>
          Price per unit
          <input
            type="number"
            min={1}
            value={form.pricePerUnit}
            onChange={(event) => setForm({ ...form, pricePerUnit: Number(event.target.value) })}
          />
        </label>
        <label>
          Harvest date
          <input
            type="date"
            value={form.harvestDate}
            onChange={(event) => setForm({ ...form, harvestDate: event.target.value })}
          />
        </label>
        <label>
          State
          <input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
        </label>
        <label>
          District
          <input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} />
        </label>
        <label>
          Mandi
          <input value={form.mandi} onChange={(event) => setForm({ ...form, mandi: event.target.value })} />
        </label>
        <label>
          Latitude
          <input
            type="number"
            value={form.latitude}
            onChange={(event) => setForm({ ...form, latitude: Number(event.target.value) })}
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            value={form.longitude}
            onChange={(event) => setForm({ ...form, longitude: Number(event.target.value) })}
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>Create listing</button>
      </form>

      {mutation.isError && <p className="status error">{(mutation.error as Error).message}</p>}
      {mutation.isSuccess && <p className="status">Listing created successfully.</p>}
    </main>
  );
}

function PricesPage() {
  const [crop, setCrop] = useState("wheat");
  const [mandi, setMandi] = useState("pune");
  const [days, setDays] = useState(7);
  const enabled = crop.trim().length > 0 && mandi.trim().length > 0;

  const latestQuery = useQuery({
    queryKey: ["price-latest", crop, mandi],
    enabled,
    queryFn: async () => apiGet<PriceLatestResponse>("/v1/prices/latest", { crop, mandi })
  });

  const historyQuery = useQuery({
    queryKey: ["price-history", crop, mandi, days],
    enabled,
    queryFn: async () => apiGet<PriceHistoryResponse>("/v1/prices/history", { crop, mandi, days })
  });

  const minMax = useMemo(() => {
    const points = historyQuery.data?.points ?? [];
    if (points.length === 0) {
      return { min: 0, max: 0 };
    }

    const modalPrices = points.map((point) => point.modalPrice);
    return { min: Math.min(...modalPrices), max: Math.max(...modalPrices) };
  }, [historyQuery.data]);

  return (
    <main className="page">
      <section className="hero compact">
        <p className="eyebrow">Mandi Watch</p>
        <h1>Latest and trend prices</h1>
        <p className="subtitle">Track movement and compare recent pricing behavior for a crop in a mandi.</p>
      </section>

      <section className="filters card">
        <label>
          Crop
          <input value={crop} onChange={(event) => setCrop(event.target.value)} />
        </label>
        <label>
          Mandi
          <input value={mandi} onChange={(event) => setMandi(event.target.value)} />
        </label>
        <label>
          Days
          <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>7</option>
            <option value={30}>30</option>
            <option value={90}>90</option>
          </select>
        </label>
      </section>

      {latestQuery.isLoading && <p className="status">Loading latest price...</p>}
      {latestQuery.isError && <p className="status error">{(latestQuery.error as Error).message}</p>}

      {latestQuery.data && (
        <section className="grid">
          <article className="card">
            <h2>Latest</h2>
            <p className="price">Rs.{latestQuery.data.price.modalPrice}/{latestQuery.data.price.unit}</p>
            <p className="muted">
              {latestQuery.data.price.mandi}, {latestQuery.data.price.state}
            </p>
          </article>
          <article className="card">
            <h2>Range</h2>
            <p>Min: Rs.{latestQuery.data.price.minPrice}</p>
            <p>Max: Rs.{latestQuery.data.price.maxPrice}</p>
            <p className="muted">Source: {latestQuery.data.source}</p>
          </article>
          <article className="card">
            <h2>{days}-day spread</h2>
            <p>Lowest modal: Rs.{minMax.min}</p>
            <p>Highest modal: Rs.{minMax.max}</p>
            <p className="muted">Points: {historyQuery.data?.points.length ?? 0}</p>
          </article>
        </section>
      )}
    </main>
  );
}

function AboutPage() {
  return (
    <main className="page">
      <h1>About</h1>
      <p>
        V1 now includes marketplace and mandi price views wired to backend endpoints with shared typed contracts.
      </p>
    </main>
  );
}

export function App() {
  const [session, setSession] = useState<DevSession>(() => readSession());
  const auth = useMemo<ApiRequestOptions>(() => {
    const token = session.token.trim();
    return token ? { token, devRole: session.role } : { devRole: session.role };
  }, [session]);

  return (
    <>
      <header className="topbar">
        <nav>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/marketplace">Marketplace</NavLink>
          <NavLink to="/sell">Sell</NavLink>
          <NavLink to="/prices">Prices</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
        <SessionBar
          session={session}
          onChange={(next) => {
            setSession(next);
            writeSession(next);
          }}
        />
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/marketplace" element={<MarketplacePage auth={auth} />} />
        <Route path="/sell" element={<SellPage auth={auth} />} />
        <Route path="/prices" element={<PricesPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </>
  );
}
