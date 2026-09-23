import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HealthStatus } from "./HealthStatus.js";

function renderWithApi(response: Response) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HealthStatus />
    </QueryClientProvider>,
  );
}

describe("HealthStatus", () => {
  it("shows the API status when /api/health answers ok", async () => {
    renderWithApi(Response.json({ status: "ok" }));

    expect(await screen.findByText("API: ok")).toBeInTheDocument();
  });

  it("shows an error when the response breaks the contract", async () => {
    renderWithApi(Response.json({ status: "<img src=x onerror=alert(1)>" }));

    expect(await screen.findByText("API: niedostępne")).toBeInTheDocument();
  });

  it("shows an error when the API responds with a server error", async () => {
    renderWithApi(new Response("boom", { status: 500 }));

    expect(await screen.findByText("API: niedostępne")).toBeInTheDocument();
  });
});
