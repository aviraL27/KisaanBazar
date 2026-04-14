import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

function renderApp(initialRoute = "/") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("App shell", () => {
  it("renders homepage with dashboard CTA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, data: { user: { uid: "dev-user", role: "buyer" } }, requestId: "r1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      )
    );

    renderApp("/");

    expect(await screen.findByText("Market intelligence for every mandi decision")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open dashboard" })).toBeInTheDocument();
  });

  it("shows buyer nav and hides farmer nav when auth role resolves to buyer", async () => {
    localStorage.setItem("kisaanbazar-dev-session", JSON.stringify({ token: "dev-token", role: "buyer", uid: "buyer_demo" }));

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/v1/auth/me")) {
          return new Response(
            JSON.stringify({ ok: true, data: { user: { uid: "dev-user", role: "buyer" } }, requestId: "r2" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        return new Response(JSON.stringify({ ok: true, data: { listings: [], count: 0 }, requestId: "r3" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      })
    );

    renderApp("/");

    expect(await screen.findByRole("link", { name: "Orders" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sell" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My Listings" })).not.toBeInTheDocument();
  });
});
