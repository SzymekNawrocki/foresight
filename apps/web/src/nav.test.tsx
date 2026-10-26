import type { AnalyzedEvent, Thread } from "@foresight/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "./router.js";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const cyber: AnalyzedEvent = {
  id: "0123456789abcdef0123456789abcdef",
  source: "the-record",
  title: "Ukraine warns hackers are exploiting surveillance cameras",
  url: "https://therecord.media/1",
  publishedAt: hoursAgo(1),
  fetchedAt: hoursAgo(0),
  analysis: {
    niche: true,
    regions: ["europe"],
    topics: ["cyber"],
    actors: ["ukraine"],
    companies: [],
    weight: 2,
    whyItMatters: "Kamery jako furtka do sieci.",
    thread: { kind: "none" },
  },
};

const space: AnalyzedEvent = {
  ...cyber,
  id: "fedcba9876543210fedcba9876543210",
  title: "New launch contract for a satellite fleet",
  url: "https://spacenews.com/1",
  analysis: { ...cyber.analysis, regions: ["north-america"], topics: ["space"] } as AnalyzedEvent["analysis"],
};

const proposal: Thread = {
  id: "bbbb0001",
  name: "IPO Anthropic",
  status: "proposed",
  createdAt: hoursAgo(5),
  lastEventAt: hoursAgo(5),
  eventCount: 1,
  newEvents: 0,
  newWeight: 0,
  regions: ["north-america"],
};

const signInAsOwner = () =>
  sessionStorage.setItem("foresight.session", JSON.stringify({ accessToken: "access-1", expiresAt: Date.now() + 3_600_000 }));

function renderApp(path: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/health") return Response.json({ status: "ok" });
      if (url === "/api/config") return Response.json({ auth: { domain: "https://login.example.com", clientId: "client-1" } });
      if (url === "/api/me") return Response.json({ signedIn: true });
      if (url === "/api/recent") return Response.json({ since: hoursAgo(72), events: [cyber, space] });
      if (url === "/api/threads") return Response.json({ threads: [] });
      if (url === "/api/threads/proposals") return Response.json({ proposals: [{ thread: proposal, timeline: [] }] });
      return new Response("not found", { status: 404 });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => sessionStorage.clear());

describe("Main navigation", () => {
  it("offers Radar, Threads and Stream to a visitor, without the Inbox", async () => {
    renderApp("/");

    const nav = within(await screen.findByRole("navigation", { name: "Główne" }));
    expect(nav.getAllByRole("link").map((a) => a.textContent)).toEqual(["Radar", "Wątki", "Strumień"]);
    expect(nav.getByRole("link", { name: "Radar" })).toHaveAttribute("aria-current", "page");
  });

  it("adds the Inbox with its count for the owner", async () => {
    signInAsOwner();
    renderApp("/");

    const nav = within(await screen.findByRole("navigation", { name: "Główne" }));
    const inbox = await nav.findByRole("link", { name: /Skrzynka/ });
    expect(inbox).toHaveAttribute("href", "/inbox");
    await waitFor(() => expect(inbox).toHaveTextContent("Skrzynka1"));
  });

  it("drops the UTC clock and the internal-use badge from the header", async () => {
    renderApp("/");

    await screen.findByRole("navigation", { name: "Główne" });
    expect(screen.queryByText(/UTC/)).toBeNull();
    expect(screen.queryByText("Użytek wewnętrzny")).toBeNull();
  });
});

describe("Old Topic and Region pages", () => {
  it("open the Stream filtered to the Topic", async () => {
    const router = renderApp("/topic/cyber");

    expect(await screen.findByRole("heading", { name: "Strumień" })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toEqual({ topic: "cyber" }));
    expect(screen.getByRole("link", { name: cyber.title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: space.title })).toBeNull();
  });

  it("open the Stream filtered to the Region", async () => {
    const router = renderApp("/region/north-america");

    expect(await screen.findByRole("heading", { name: "Strumień" })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toEqual({ region: "north-america" }));
    expect(screen.getByRole("link", { name: space.title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: cyber.title })).toBeNull();
  });

  it("ignore an unknown filter in the address instead of trusting it", async () => {
    renderApp("/stream?topic=atlantis");

    expect((await screen.findAllByRole("link", { name: cyber.title })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: space.title }).length).toBeGreaterThan(0);
  });
});

describe("Screens", () => {
  it("say in one line what each one is for", async () => {
    renderApp("/stream");

    expect(await screen.findByText("Wszystkie Zdarzenia z Niszy: mapa, Tematy i pełna lista meldunków.")).toBeInTheDocument();
  });

  it("show times as relative, with the full Warsaw time kept on the element", async () => {
    renderApp("/stream");

    const [stamp] = await screen.findAllByText("1 h temu");
    expect(stamp?.closest("time")).toHaveAttribute("dateTime", cyber.publishedAt);
  });

  it("give the Inbox its own page for the owner", async () => {
    signInAsOwner();
    renderApp("/inbox");

    expect(await screen.findByRole("heading", { name: "Skrzynka" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "IPO Anthropic" })).toBeInTheDocument();
  });

  it("ask a visitor on the Inbox page to sign in", async () => {
    renderApp("/inbox");

    expect(await screen.findByText("Skrzynka jest dostępna po zalogowaniu.")).toBeInTheDocument();
  });
});
