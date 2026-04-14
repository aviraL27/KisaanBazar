import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import type {
  AuthDevLoginResponse,
  AuthFirebasePasswordLoginResponse,
  AuthMeResponse,
  AuthModeResponse,
  CreateListingInput,
  CreateListingResponse,
  HealthDependenciesResponse,
  ListListingsResponse,
  ListMyListingsResponse,
  ListMyOrdersResponse,
  Order,
  OrderStatus,
  PriceAlertsResponse,
  PlaceOrderInput,
  PlaceOrderResponse,
  PriceHistoryResponse,
  PriceLatestResponse,
  PriceRegionalInsightsResponse,
  UpdateListingStatusInput,
  UpdateListingStatusResponse,
  UserRole
} from "@kisaanbazar/shared";
import { apiGet, apiPatch, apiPost, type ApiRequestOptions } from "./lib/api";

interface DevSession {
  token: string;
  role: UserRole;
  uid: string;
}

interface AuthState {
  tokenPresent: boolean;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  user?: AuthMeResponse["user"];
}

const sessionStorageKey = "kisaanbazar-dev-session";

function readSession(): DevSession {
  const fallback: DevSession = { token: "", role: "buyer", uid: "buyer_demo" };
  const raw = window.localStorage.getItem(sessionStorageKey);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DevSession>;
    if (
      typeof parsed.token === "string" &&
      typeof parsed.uid === "string" &&
      (parsed.role === "buyer" || parsed.role === "farmer" || parsed.role === "admin")
    ) {
      return { token: parsed.token, role: parsed.role, uid: parsed.uid };
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function writeSession(session: DevSession): void {
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function SessionBar(props: { session: DevSession; onChange: (next: DevSession) => void }) {
  const { session, onChange } = props;

  return (
    <div className="session-bar">
      <label>
        User id
        <input
          value={session.uid}
          onChange={(event) => onChange({ ...session, uid: event.target.value })}
          placeholder="e.g. buyer_raj_01"
        />
      </label>
      <label>
        Bearer token
        <input
          value={session.token}
          onChange={(event) => onChange({ ...session, token: event.target.value })}
          placeholder="required for protected endpoints"
        />
      </label>
      <label>
        Session role
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

function UserBadge(props: { authState: AuthState; sessionRole: UserRole }) {
  const { authState, sessionRole } = props;

  if (!authState.tokenPresent) {
    return <p className="user-badge">Guest mode active. Login to access orders, sell, and listing management.</p>;
  }

  if (authState.isLoading) {
    return <p className="user-badge">Checking user session...</p>;
  }

  if (authState.isError) {
    return <p className="user-badge error">Auth check failed: {authState.errorMessage}</p>;
  }

  if (!authState.user) {
    return <p className="user-badge warning">Signed in token present but no user resolved.</p>;
  }

  return (
    <p className="user-badge success">
      Signed in as <strong>{authState.user.role}</strong> ({authState.user.uid})
      {authState.user.role !== sessionRole ? `, session role=${sessionRole}` : ""}
    </p>
  );
}

function GuardedRoute(props: {
  authState: AuthState;
  allowedRoles: UserRole[];
  title: string;
  children: ReactNode;
}) {
  const { authState, allowedRoles, title, children } = props;

  if (!authState.tokenPresent) {
    return (
      <main className="page">
        <section className="card auth-state">
          <h1>{title}</h1>
          <p className="status error">Missing bearer token. Add a token in the session bar to continue.</p>
        </section>
      </main>
    );
  }

  if (authState.isLoading) {
    return (
      <main className="page">
        <section className="card auth-state">
          <h1>{title}</h1>
          <p className="status">Loading user profile...</p>
        </section>
      </main>
    );
  }

  if (authState.isError || !authState.user) {
    return (
      <main className="page">
        <section className="card auth-state">
          <h1>{title}</h1>
          <p className="status error">Unable to verify user: {authState.errorMessage || "Unknown error"}</p>
        </section>
      </main>
    );
  }

  if (!allowedRoles.includes(authState.user.role)) {
    return (
      <main className="page">
        <section className="card auth-state">
          <h1>{title}</h1>
          <p className="status error">Role {authState.user.role} cannot access this page.</p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
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
          <Link className="btn btn-primary" to="/login">Login</Link>
          <Link className="btn btn-primary" to="/dashboard">Open dashboard</Link>
          <Link className="btn btn-primary" to="/marketplace">Open marketplace</Link>
          <Link className="btn btn-secondary" to="/prices">View mandi prices</Link>
        </div>
      </section>

      <section className="grid home-highlights">
        <article className="card">
          <h2>For buyers</h2>
          <p className="muted">Compare listings, place protected orders, and track status transitions in one timeline.</p>
          <Link className="btn btn-secondary" to="/orders">View order history</Link>
        </article>
        <article className="card">
          <h2>For farmers</h2>
          <p className="muted">Publish listings quickly and manage lifecycle states as stock changes in real time.</p>
          <Link className="btn btn-secondary" to="/farmer/listings">Manage listings</Link>
        </article>
        <article className="card">
          <h2>For operations</h2>
          <p className="muted">Use role-aware routes, typed API contracts, and integration-tested order flows.</p>
          <Link className="btn btn-secondary" to="/about">Read platform scope</Link>
        </article>
      </section>
    </main>
  );
}

function LoginPage(props: { session: DevSession; onLogin: (session: DevSession) => void }) {
  const { session, onLogin } = props;
  const navigate = useNavigate();
  const [uid, setUid] = useState(session.uid || "buyer_demo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(session.role);

  const modeQuery = useQuery({
    queryKey: ["auth-mode"],
    queryFn: async () => apiGet<AuthModeResponse>("/v1/auth/mode"),
    retry: false
  });

  const completeLogin = async (token: string, fallbackUid: string, fallbackRole: UserRole) => {
    const me = await apiGet<AuthMeResponse>("/v1/auth/me", undefined, {
      token,
      devRole: fallbackRole,
      devUid: fallbackUid
    });

    const nextSession: DevSession = {
      token,
      role: me.user.role,
      uid: me.user.uid
    };

    onLogin(nextSession);
    navigate("/dashboard");
  };

  const devLoginMutation = useMutation({
    mutationFn: async () =>
      apiPost<AuthDevLoginResponse, { uid: string; role: UserRole }>("/v1/auth/dev-login", {
        uid: uid.trim(),
        role
      }),
    onSuccess: async (data) => {
      await completeLogin(data.token, data.user.uid, data.user.role);
    }
  });

  const firebaseLoginMutation = useMutation({
    mutationFn: async () =>
      apiPost<AuthFirebasePasswordLoginResponse, { email: string; password: string }>(
        "/v1/auth/firebase/password-login",
        {
          email: email.trim(),
          password
        }
      ),
    onSuccess: async (data) => {
      await completeLogin(data.token, data.uid, role);
    }
  });

  const isFirebaseMode = modeQuery.data?.firebaseAuthEnforced ?? false;
  const loginError = (firebaseLoginMutation.error ?? devLoginMutation.error) as Error | null;

  return (
    <main className="page">
      <section className="hero hero-home">
        <p className="eyebrow">Sign in</p>
        <h1>Access your KisaanBazaar dashboard</h1>
        <p className="subtitle">
          {isFirebaseMode
            ? "Firebase auth is enforced. Sign in with your real Firebase account credentials."
            : "Use a buyer, farmer, or admin role to enter the live marketplace workspace."}
        </p>
      </section>

      {modeQuery.isLoading && <p className="status">Loading auth mode...</p>}
      {modeQuery.isError && <p className="status error">{(modeQuery.error as Error).message}</p>}

      <form
        className="card login-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (isFirebaseMode) {
            firebaseLoginMutation.mutate();
            return;
          }

          devLoginMutation.mutate();
        }}
      >
        {isFirebaseMode ? (
          <>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your-firebase-user@email.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="firebase password"
                required
              />
            </label>
          </>
        ) : (
          <label>
            User ID
            <input
              value={uid}
              onChange={(event) => setUid(event.target.value)}
              placeholder="e.g. farmer_mahesh_01"
              required
            />
          </label>
        )}
        <label>
          Session role
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            <option value="buyer">Buyer</option>
            <option value="farmer">Farmer</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={
            modeQuery.isLoading ||
            devLoginMutation.isPending ||
            firebaseLoginMutation.isPending ||
            (isFirebaseMode ? email.trim().length < 5 || password.length < 6 : uid.trim().length < 3)
          }
        >
          {devLoginMutation.isPending || firebaseLoginMutation.isPending ? "Signing in..." : "Login"}
        </button>
      </form>

      {isFirebaseMode && modeQuery.data && !modeQuery.data.firebasePasswordLoginEnabled && (
        <p className="status error">Firebase password login is not enabled on API. Add FIREBASE_WEB_API_KEY in API env.</p>
      )}
      {loginError && <p className="status error">{loginError.message}</p>}
    </main>
  );
}

function DashboardPage(props: { auth: ApiRequestOptions; authState: AuthState }) {
  const { auth, authState } = props;
  const role = authState.user?.role;
  const [crop, setCrop] = useState("wheat");
  const [mandi, setMandi] = useState("pune");

  const listingsQuery = useQuery({
    queryKey: ["dashboard-listings"],
    queryFn: async () => apiGet<ListListingsResponse>("/v1/listings", { limit: 6 })
  });

  const latestPriceQuery = useQuery({
    queryKey: ["dashboard-price", crop, mandi],
    queryFn: async () => apiGet<PriceLatestResponse>("/v1/prices/latest", { crop, mandi }),
    enabled: crop.trim().length > 0 && mandi.trim().length > 0
  });

  const myOrdersQuery = useQuery({
    queryKey: ["dashboard-my-orders"],
    queryFn: async () => apiGet<ListMyOrdersResponse>("/v1/orders/mine", { limit: 5 }, auth),
    enabled: role === "buyer" || role === "admin"
  });

  const myListingsQuery = useQuery({
    queryKey: ["dashboard-my-listings"],
    queryFn: async () => apiGet<ListMyListingsResponse>("/v1/listings/mine", { limit: 12 }, auth),
    enabled: role === "farmer" || role === "admin"
  });

  const depsQuery = useQuery({
    queryKey: ["health-dependencies"],
    queryFn: async () => apiGet<HealthDependenciesResponse>("/v1/health/dependencies")
  });

  const activeCount = listingsQuery.data?.listings.length ?? 0;
  const myOrdersCount = myOrdersQuery.data?.count ?? 0;
  const myListingsCount = myListingsQuery.data?.count ?? 0;
  const soldOutCount = myListingsQuery.data?.listings.filter((listing) => listing.status === "sold_out").length ?? 0;

  return (
    <main className="page">
      <section className="hero compact">
        <p className="eyebrow">Command Center</p>
        <h1>KisaanBazaar dashboard</h1>
        <p className="subtitle">Role-aware snapshot for demand, supply, and price movement to drive next action.</p>
      </section>

      <section className="grid metrics-grid">
        <article className="card metric-card">
          <p className="metric-label">Live listings</p>
          <p className="metric-value">{activeCount}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">My orders</p>
          <p className="metric-value">{role === "buyer" || role === "admin" ? myOrdersCount : "-"}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">My listings</p>
          <p className="metric-value">{role === "farmer" || role === "admin" ? myListingsCount : "-"}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Sold out listings</p>
          <p className="metric-value">{role === "farmer" || role === "admin" ? soldOutCount : "-"}</p>
        </article>
      </section>

      {depsQuery.data && (
        <section className="card dependency-card">
          <h2>Infrastructure status</h2>
          <div className="dependency-grid">
            <p>MongoDB: <strong>{depsQuery.data.mongoConnected ? "connected" : "disconnected"}</strong></p>
            <p>Redis: <strong>{depsQuery.data.redisConnected ? "connected" : "disconnected"}</strong></p>
            <p>Cache round trip: <strong>{depsQuery.data.cacheRoundTripOk ? "ok" : "failed"}</strong></p>
          </div>
        </section>
      )}

      <section className="grid dashboard-grid">
        <article className="card">
          <h2>Quick actions</h2>
          <div className="quick-actions">
            <Link className="btn btn-secondary" to="/marketplace">Browse marketplace</Link>
            {(role === "buyer" || role === "admin") && (
              <Link className="btn btn-secondary" to="/orders">Track my orders</Link>
            )}
            {(role === "farmer" || role === "admin") && (
              <>
                <Link className="btn btn-secondary" to="/sell">Create listing</Link>
                <Link className="btn btn-secondary" to="/farmer/listings">Manage listing status</Link>
              </>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Price pulse</h2>
          <div className="filters compact-filters">
            <label>
              Crop
              <input value={crop} onChange={(event) => setCrop(event.target.value)} />
            </label>
            <label>
              Mandi
              <input value={mandi} onChange={(event) => setMandi(event.target.value)} />
            </label>
          </div>
          {latestPriceQuery.isLoading && <p className="status">Loading price snapshot...</p>}
          {latestPriceQuery.isError && <p className="status error">{(latestPriceQuery.error as Error).message}</p>}
          {latestPriceQuery.data && (
            <>
              <p className="price">Rs.{latestPriceQuery.data.price.modalPrice}/{latestPriceQuery.data.price.unit}</p>
              <p className="muted">{latestPriceQuery.data.price.mandi}, {latestPriceQuery.data.price.state}</p>
            </>
          )}
        </article>

        <article className="card">
          <h2>Recent listings</h2>
          {listingsQuery.isLoading && <p className="status">Loading listings...</p>}
          {listingsQuery.isError && <p className="status error">{(listingsQuery.error as Error).message}</p>}
          {listingsQuery.data && listingsQuery.data.count === 0 && <p className="status">No active listings right now.</p>}
          {listingsQuery.data && listingsQuery.data.count > 0 && (
            <ul className="simple-list">
              {listingsQuery.data.listings.map((listing) => (
                <li key={listing.id}>
                  <strong>{listing.crop}</strong> - {listing.quantity} {listing.unit} at Rs.{listing.pricePerUnit}/{listing.unit}
                </li>
              ))}
            </ul>
          )}
        </article>
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
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
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
    onSuccess: async (data) => {
      setLastOrder(data.order);
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
      await queryClient.invalidateQueries({ queryKey: ["orders-mine"] });
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
      {orderMutation.isSuccess && lastOrder && (
        <section className="card success-panel">
          <h2>Order placed successfully</h2>
          <p>
            {lastOrder.item.crop} x {lastOrder.item.qty} {lastOrder.item.unit} for Rs.{lastOrder.amountTotal}
          </p>
          <p className="muted">Order ID: {lastOrder.id}</p>
          <Link className="btn btn-secondary" to="/orders">Open order history</Link>
        </section>
      )}
    </main>
  );
}

function timelineForStatus(status: OrderStatus): { id: string; label: string; state: "done" | "current" | "pending" }[] {
  const happyFlow: OrderStatus[] = ["placed", "confirmed", "shipped", "delivered"];
  const cancelledFlow: OrderStatus[] = ["placed", "cancelled"];
  const rejectedFlow: OrderStatus[] = ["placed", "rejected"];
  const counteredFlow: OrderStatus[] = ["placed", "countered"];
  const disputedFlow: OrderStatus[] = ["placed", "confirmed", "disputed"];

  const flow =
    status === "cancelled"
      ? cancelledFlow
      : status === "rejected"
        ? rejectedFlow
        : status === "countered"
          ? counteredFlow
          : status === "disputed"
            ? disputedFlow
            : happyFlow;

  const currentIndex = flow.indexOf(status);
  return flow.map((step, index) => ({
    id: step,
    label: step.replace("_", " "),
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "pending"
  }));
}

function OrderHistoryCard(props: { order: Order }) {
  const { order } = props;
  const timeline = timelineForStatus(order.status);

  return (
    <article className="card order-card">
      <div className="card-head">
        <h2>{order.item.crop}</h2>
        <span className="badge">{order.status}</span>
      </div>
      <p>
        Qty: {order.item.qty} {order.item.unit} at Rs.{order.item.pricePerUnit}/{order.item.unit}
      </p>
      <p>Total: Rs.{order.amountTotal}</p>
      <p className="muted">Placed on {formatDate(order.createdAt)}</p>
      <ol className="timeline">
        {timeline.map((step) => (
          <li key={step.id} className={`timeline-item ${step.state}`}>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function BuyerOrdersPage(props: { auth: ApiRequestOptions }) {
  const { auth } = props;
  const [limit, setLimit] = useState(20);

  const query = useQuery({
    queryKey: ["orders-mine", limit],
    queryFn: async () => apiGet<ListMyOrdersResponse>("/v1/orders/mine", { limit }, auth)
  });

  return (
    <main className="page">
      <section className="hero compact">
        <p className="eyebrow">Buyer Desk</p>
        <h1>Order history</h1>
        <p className="subtitle">Track every order from placement to closure through a clear status timeline.</p>
      </section>

      <section className="filters card">
        <label>
          Show latest
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
      </section>

      {query.isLoading && <p className="status">Loading your orders...</p>}
      {query.isError && <p className="status error">{(query.error as Error).message}</p>}

      {query.data && query.data.count === 0 && (
        <section className="card empty-state">
          <h2>No orders yet</h2>
          <p className="muted">Place your first order from Marketplace to see status updates here.</p>
          <Link className="btn btn-secondary" to="/marketplace">Browse listings</Link>
        </section>
      )}

      {query.data && query.data.count > 0 && (
        <section className="grid order-grid">
          {query.data.orders.map((order) => (
            <OrderHistoryCard key={order.id} order={order} />
          ))}
        </section>
      )}
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
      await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
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

function FarmerListingsPage(props: { auth: ApiRequestOptions }) {
  const { auth } = props;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-listings"],
    queryFn: async () => apiGet<ListMyListingsResponse>("/v1/listings/mine", { limit: 50 }, auth)
  });

  const mutation = useMutation({
    mutationFn: async (input: { listingId: string; status: UpdateListingStatusInput["status"] }) => {
      return apiPatch<UpdateListingStatusResponse, UpdateListingStatusInput>(
        `/v1/listings/${input.listingId}/status`,
        { status: input.status },
        auth
      );
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["my-listings"] });
      const previous = queryClient.getQueryData<ListMyListingsResponse>(["my-listings"]);

      if (previous) {
        queryClient.setQueryData<ListMyListingsResponse>(["my-listings"], {
          ...previous,
          listings: previous.listings.map((listing) =>
            listing.id === input.listingId ? { ...listing, status: input.status } : listing
          )
        });
      }

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["my-listings"], context.previous);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["listings"] });
    }
  });

  return (
    <main className="page">
      <section className="hero compact">
        <p className="eyebrow">Farmer Desk</p>
        <h1>Manage listings</h1>
        <p className="subtitle">Pause, mark sold out, or archive your existing listings in one place.</p>
      </section>

      {query.isLoading && <p className="status">Loading your listings...</p>}
      {query.isError && <p className="status error">{(query.error as Error).message}</p>}

      {query.data && query.data.count === 0 && (
        <section className="card empty-state">
          <h2>No listings yet</h2>
          <p className="muted">Create your first listing from the Sell page.</p>
          <Link className="btn btn-secondary" to="/sell">Go to Sell</Link>
        </section>
      )}

      {query.data && query.data.count > 0 && (
        <section className="grid farmer-listings-grid">
          {query.data.listings.map((listing) => {
            const isBusy = mutation.isPending;

            return (
              <article className="card farmer-listing-card" key={listing.id}>
                <div className="card-head">
                  <h2>{listing.crop}</h2>
                  <span className="badge">{listing.status}</span>
                </div>
                <p>
                  {listing.quantity} {listing.unit} at Rs.{listing.pricePerUnit}/{listing.unit}
                </p>
                <p className="muted">
                  {listing.locationMeta.mandi}, {listing.locationMeta.district}, {listing.locationMeta.state}
                </p>
                <div className="listing-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isBusy || listing.status === "paused"}
                    onClick={() => mutation.mutate({ listingId: listing.id, status: "paused" })}
                  >
                    Pause
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isBusy || listing.status === "sold_out"}
                    onClick={() => mutation.mutate({ listingId: listing.id, status: "sold_out" })}
                  >
                    Sold out
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={isBusy || listing.status === "archived"}
                    onClick={() => mutation.mutate({ listingId: listing.id, status: "archived" })}
                  >
                    Archive
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {mutation.isError && <p className="status error">{(mutation.error as Error).message}</p>}
      {mutation.isSuccess && <p className="status">Listing status updated.</p>}
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

  const alertsQuery = useQuery({
    queryKey: ["price-alerts", crop, mandi, days],
    enabled,
    queryFn: async () => apiGet<PriceAlertsResponse>("/v1/prices/alerts", { crop, mandi, days })
  });

  const insightsQuery = useQuery({
    queryKey: ["price-insights-regions", crop, days],
    enabled: crop.trim().length > 0,
    queryFn: async () => apiGet<PriceRegionalInsightsResponse>("/v1/prices/insights/regions", { crop, days })
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

      {alertsQuery.data && (
        <section className="card alerts-card">
          <h2>Anomaly alerts ({alertsQuery.data.alerts.length})</h2>
          <p className="muted">
            Baseline modal for {alertsQuery.data.days} days: Rs.{alertsQuery.data.windowAvg}
          </p>
          {alertsQuery.data.alerts.length === 0 && <p className="status">No strong anomalies in the selected window.</p>}
          {alertsQuery.data.alerts.length > 0 && (
            <ul className="simple-list">
              {alertsQuery.data.alerts.slice(0, 6).map((alert) => (
                <li key={`${alert.ts}-${alert.modalPrice}`}>
                  {formatDate(alert.ts)}: Rs.{alert.modalPrice} ({alert.deviationPct}% vs baseline, {alert.severity})
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {insightsQuery.data && (
        <section className="card regional-insights-card">
          <h2>Regional insights</h2>
          {insightsQuery.data.regions.length === 0 && <p className="status">No regional records found for this crop.</p>}
          {insightsQuery.data.regions.length > 0 && (
            <div className="regional-table-wrap">
              <table className="regional-table">
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Mandis</th>
                    <th>Avg latest</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Volatility %</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {insightsQuery.data.regions.map((region) => (
                    <tr key={region.state}>
                      <td>{region.state}</td>
                      <td>{region.mandiCount}</td>
                      <td>Rs.{region.latestModalPriceAvg}</td>
                      <td>Rs.{region.latestModalPriceMin}</td>
                      <td>Rs.{region.latestModalPriceMax}</td>
                      <td>{region.sevenDayVolatilityPct}</td>
                      <td>{region.trend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
        V1 now includes marketplace, buyer orders, farmer listing management, and mandi price views wired to backend endpoints with shared typed contracts.
      </p>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="page">
      <section className="card empty-state">
        <h1>Page not found</h1>
        <p className="muted">The route you requested does not exist in this build.</p>
        <Link className="btn btn-secondary" to="/dashboard">Go to dashboard</Link>
      </section>
    </main>
  );
}

function AppFooter(props: { authState: AuthState }) {
  const { authState } = props;
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:4000";
  const authLabel = authState.user ? `${authState.user.uid} (${authState.user.role})` : "guest";

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <p>KisaanBazaar v1 web console</p>
        <p>API: {apiBase}</p>
        <p>Session: {authLabel}</p>
      </div>
    </footer>
  );
}

export function App() {
  const [session, setSession] = useState<DevSession>(() => readSession());
  const auth = useMemo<ApiRequestOptions>(() => {
    const token = session.token.trim();
    const devUid = session.uid.trim();
    return token ? { token, devRole: session.role, devUid } : { devRole: session.role, devUid };
  }, [session]);

  const meQuery = useQuery({
    queryKey: ["auth-me", auth.token, auth.devRole],
    queryFn: async () => apiGet<AuthMeResponse>("/v1/auth/me", undefined, auth),
    enabled: Boolean(auth.token),
    retry: false
  });

  const authState: AuthState = {
    tokenPresent: Boolean(auth.token),
    isLoading: meQuery.isLoading,
    isError: meQuery.isError,
    errorMessage: meQuery.isError ? (meQuery.error as Error).message : "",
    ...(meQuery.data?.user ? { user: meQuery.data.user } : {})
  };

  const navRole = authState.user?.role;

  const persistSession = (next: DevSession) => {
    setSession(next);
    writeSession(next);
  };

  const clearSession = () => {
    const empty: DevSession = { token: "", role: "buyer", uid: "buyer_demo" };
    persistSession(empty);
  };

  return (
    <>
      <header className="topbar">
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/">Home</NavLink>
          {!auth.token && <NavLink to="/login">Login</NavLink>}
          <NavLink to="/marketplace">Marketplace</NavLink>
          {(navRole === "buyer" || navRole === "admin") && <NavLink to="/orders">Orders</NavLink>}
          {(navRole === "farmer" || navRole === "admin") && <NavLink to="/sell">Sell</NavLink>}
          {(navRole === "farmer" || navRole === "admin") && <NavLink to="/farmer/listings">My Listings</NavLink>}
          <NavLink to="/prices">Prices</NavLink>
          <NavLink to="/about">About</NavLink>
          {auth.token && (
            <button type="button" className="btn btn-secondary logout-btn" onClick={clearSession}>
              Logout
            </button>
          )}
        </nav>
        <SessionBar
          session={session}
          onChange={persistSession}
        />
        <div className="identity-row">
          <UserBadge authState={authState} sessionRole={session.role} />
        </div>
      </header>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage auth={auth} authState={authState} />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage session={session} onLogin={persistSession} />} />
        <Route path="/marketplace" element={<MarketplacePage auth={auth} />} />
        <Route
          path="/orders"
          element={
            <GuardedRoute authState={authState} allowedRoles={["buyer", "admin"]} title="Order history">
              <BuyerOrdersPage auth={auth} />
            </GuardedRoute>
          }
        />
        <Route
          path="/sell"
          element={
            <GuardedRoute authState={authState} allowedRoles={["farmer", "admin"]} title="Create listing">
              <SellPage auth={auth} />
            </GuardedRoute>
          }
        />
        <Route
          path="/farmer/listings"
          element={
            <GuardedRoute authState={authState} allowedRoles={["farmer", "admin"]} title="Manage listings">
              <FarmerListingsPage auth={auth} />
            </GuardedRoute>
          }
        />
        <Route path="/prices" element={<PricesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <AppFooter authState={authState} />
    </>
  );
}
