import type { Thread, TimelineEntry } from "@foresight/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "./router.js";
import { UNDO_MS } from "./inbox.js";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const entry = (n: number): TimelineEntry => ({
  eventId: n.toString(16).padStart(32, "0"),
  title: `Sudan headline ${n}`,
  url: `https://www.reuters.com/world/africa/${n}`,
  source: "reuters",
  tier: "B",
  publishedAt: hoursAgo(n),
  linkedAt: hoursAgo(n),
  weight: 2,
  whyItMatters: "Wojna przesuwa szlaki.",
  actors: ["egypt"],
  regions: ["africa"],
});

const proposal: Thread = {
  id: "bbbb0001",
  name: "Wojna w Sudanie",
  status: "proposed",
  createdAt: hoursAgo(3),
  lastEventAt: hoursAgo(1),
  eventCount: 5,
  newEvents: 0,
  newWeight: 0,
  regions: ["africa"],
  topics: ["drones"],
  actors: ["egypt"],
};

const tracked = (id: string, name: string, extra: Partial<Thread> = {}): Thread & { dormant: boolean } => ({
  ...proposal,
  id,
  name,
  status: "active",
  topics: [],
  actors: [],
  dormant: false,
  ...extra,
});

const threads = [
  tracked("aaaa0001", "Cieśnina Ormuz", { actors: ["iran"] }),
  tracked("aaaa0002", "Morze Czerwone", { actors: ["egypt"] }),
];

function renderInbox() {
  let open = [{ thread: proposal, timeline: [1, 2, 3, 4, 5].map(entry) }];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/health") return Response.json({ status: "ok" });
    if (url === "/api/config") return Response.json({ auth: { domain: "https://login.example.com", clientId: "client-1" } });
    if (url === "/api/me") return Response.json({ signedIn: true });
    if (url === "/api/recent") return Response.json({ since: hoursAgo(72), events: [] });
    if (url === "/api/threads") return Response.json({ threads });
    if (url === "/api/threads/proposals") return Response.json({ proposals: open });
    if (url === "/api/threads/proposals/bbbb0001" && init?.method === "POST") {
      open = [];
      return Response.json({ ok: true });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: ["/inbox"] }))} />
    </QueryClientProvider>,
  );
  return fetchMock;
}

const decisions = (fetchMock: ReturnType<typeof renderInbox>) =>
  fetchMock.mock.calls.filter(([url, init]) => url === "/api/threads/proposals/bbbb0001" && init?.method === "POST").map(([, init]) => init?.body);

const card = async () => within((await screen.findByRole("heading", { name: "Wojna w Sudanie" })).closest("article") as HTMLElement);
const navInbox = () => within(screen.getByRole("navigation", { name: "Główne" })).getByRole("link", { name: /Skrzynka/ });

beforeEach(() =>
  sessionStorage.setItem("foresight.session", JSON.stringify({ accessToken: "access-1", expiresAt: Date.now() + 3_600_000 })),
);
afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("Inbox card", () => {
  it("shows the proposal with its Event count, Region, when it came and the first headlines", async () => {
    renderInbox();

    const c = await card();
    expect(c.getByText(/5 Zdarzeń · Afryka · zaproponowano/)).toBeInTheDocument();
    expect(c.getAllByRole("link").map((a) => a.textContent)).toEqual(["Sudan headline 1", "Sudan headline 2", "Sudan headline 3"]);
    fireEvent.click(c.getByRole("button", { name: "Pokaż wszystkie (5)" }));
    expect(c.getByRole("link", { name: "Sudan headline 5" })).toBeInTheDocument();
  });

  it("follows the proposal as a new Thread, then the card leaves and the nav count drops", async () => {
    const fetchMock = renderInbox();

    const c = await card();
    await waitFor(() => expect(navInbox()).toHaveTextContent("Skrzynka1"));
    fireEvent.click(c.getByRole("button", { name: "Śledź jako nowy Wątek" }));

    await waitFor(() => expect(decisions(fetchMock)).toEqual([JSON.stringify({ action: "accept" })]));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Wojna w Sudanie" })).toBeNull());
    expect(navInbox()).toHaveTextContent(/^Skrzynka$/);
  });
});

describe("Join a Thread", () => {
  it("suggests Threads sharing an Actor first, searches by name and joins the picked one", async () => {
    const fetchMock = renderInbox();

    fireEvent.click((await card()).getByRole("button", { name: "Dołącz do Wątku…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Dołącz do Wątku" }));
    const suggested = within(dialog.getByRole("list", { name: "Podobne" }));
    expect(suggested.getByRole("button", { name: /Morze Czerwone/ })).toHaveTextContent("wspólne: Egipt");
    expect(within(dialog.getByRole("list", { name: "Pozostałe" })).getByRole("button", { name: /Cieśnina Ormuz/ })).toBeInTheDocument();

    fireEvent.change(dialog.getByRole("searchbox", { name: "Szukaj Wątku" }), { target: { value: "ormuz" } });
    expect(dialog.queryByRole("button", { name: /Morze Czerwone/ })).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: /Cieśnina Ormuz/ }));

    await waitFor(() => expect(decisions(fetchMock)).toEqual([JSON.stringify({ action: "merge", into: "aaaa0001" })]));
  });
});

describe("Reject", () => {
  it("hides the card at once and offers Undo; undoing sends nothing", async () => {
    const fetchMock = renderInbox();

    fireEvent.click((await card()).getByRole("button", { name: "Odrzuć" }));
    expect(screen.queryByRole("heading", { name: "Wojna w Sudanie" })).toBeNull();
    const toast = within(screen.getByRole("status", { name: "Powiadomienie" }));
    expect(toast.getByText("Odrzucono: Wojna w Sudanie")).toBeInTheDocument();
    fireEvent.click(toast.getByRole("button", { name: "Cofnij" }));

    expect(await screen.findByRole("heading", { name: "Wojna w Sudanie" })).toBeInTheDocument();
    expect(decisions(fetchMock)).toEqual([]);
  });

  it("sends the reject only after the undo window", async () => {
    const fetchMock = renderInbox();
    const c = await card();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    fireEvent.click(c.getByRole("button", { name: "Odrzuć" }));
    act(() => vi.advanceTimersByTime(UNDO_MS - 100));
    expect(decisions(fetchMock)).toEqual([]);
    act(() => vi.advanceTimersByTime(200));

    await waitFor(() => expect(decisions(fetchMock)).toEqual([JSON.stringify({ action: "reject" })]));
    expect(UNDO_MS).toBe(5_000);
  });
});
