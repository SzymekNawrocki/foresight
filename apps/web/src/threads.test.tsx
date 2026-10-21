import type { SituationReport, Thread, TimelineEntry } from "@foresight/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "./router.js";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const thread: Thread = {
  id: "aaaa0001",
  name: "Cieśnina Ormuz",
  status: "active",
  createdAt: hoursAgo(72),
  lastEventAt: hoursAgo(1),
  eventCount: 4,
  newEvents: 0,
  newWeight: 0,
  regions: ["middle-east"],
  reportedAt: hoursAgo(2),
  lead: { scenario: "Napięcie bez blokady", likelihood: "prawdopodobne", change: "up" },
  moves: [{ kind: "shift", scenario: "Napięcie bez blokady", from: "mniej więcej po równo", to: "prawdopodobne" }],
};

const entry: TimelineEntry = {
  eventId: "a".repeat(32),
  title: "US Navy escorts tankers through Hormuz",
  url: "https://www.defense.gov/News/1",
  source: "us-dod",
  tier: "A",
  publishedAt: hoursAgo(3),
  linkedAt: hoursAgo(2),
  weight: 3,
  whyItMatters: "Eskorta zmienia ryzyko dla ropy.",
  actors: ["usa", "iran"],
  regions: ["middle-east"],
};

const scenario = (kind: "escalation" | "status-quo" | "deescalation", likelihood: SituationReport["scenarios"][number]["likelihood"]) => ({
  kind,
  name: kind === "status-quo" ? "Napięcie bez blokady" : kind,
  description: "Opis.",
  likelihood,
  change: kind === "status-quo" ? ("up" as const) : ("same" as const),
  previous: likelihood,
  reason: kind === "status-quo" ? "mniej więcej po równo → prawdopodobne; zapalone sygnały: „Eskorty konwojów”" : "bez zmian",
  signals:
    kind === "status-quo"
      ? [{ text: "Eskorty konwojów", lit: true, evidence: { eventId: entry.eventId, title: entry.title, url: entry.url, source: "us-dod", tier: "A" as const }, litAt: hoursAgo(2) }]
      : [{ text: "Zamknięcie cieśniny", lit: false }],
});

const report: SituationReport = {
  createdAt: hoursAgo(2),
  model: "openai/gpt-oss-120b",
  state: "USA eskortują tankowce, Iran grozi.",
  actors: [{ name: "Iran", interest: "Presja na sankcje." }],
  scenarios: [scenario("escalation", "mało prawdopodobne"), scenario("status-quo", "prawdopodobne"), scenario("deescalation", "mało prawdopodobne")],
  mostLikely: "status-quo",
  assets: [{ name: "ropa", direction: "up", why: "Ryzyko podaży." }],
  relations: "USA–Iran.",
  whatChanged: "Ruszyły eskorty.",
  basedOn: 1,
  rejectedSignals: 0,
};

const proposal: Thread = { ...thread, id: "bbbb0001", name: "Wojna w Sudanie", status: "proposed", lead: undefined, moves: undefined };

function renderApp(path: string) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/health") return Response.json({ status: "ok" });
    if (url === "/api/config") return Response.json({ auth: { domain: "https://login.example.com", clientId: "client-1" } });
    if (url === "/api/me") return Response.json({ signedIn: true });
    if (url === "/api/recent") return Response.json({ since: hoursAgo(72), events: [] });
    if (url === "/api/threads") return Response.json({ threads: [{ ...thread, dormant: false }] });
    if (url === "/api/threads/aaaa0001") return Response.json({ thread: { ...thread, dormant: false }, report, timeline: [entry] });
    if (url === "/api/threads/proposals") return Response.json({ proposals: [{ thread: proposal, timeline: [entry] }] });
    if (url === "/api/threads/proposals/bbbb0001" && init?.method === "POST") return Response.json({ ok: true });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))} />
    </QueryClientProvider>,
  );
  return fetchMock;
}

afterEach(() => sessionStorage.clear());

describe("Thread page", () => {
  it("shows the scenarios with Likelihood, the arrow from code and a lit signal linked to its evidence", async () => {
    renderApp("/thread/aaaa0001");

    expect(await screen.findByRole("heading", { name: "Cieśnina Ormuz" })).toBeInTheDocument();
    const lead = screen.getByText(/najbardziej prawdopodobny/).closest("article") as HTMLElement;
    expect(within(lead).getByText("↑")).toBeInTheDocument();
    expect(within(lead).getByText(/mniej więcej po równo → prawdopodobne/)).toBeInTheDocument();
    const signals = within(lead).getByRole("list", { name: "Sygnały: Napięcie bez blokady" });
    expect(within(signals).getByText("● zapalony")).toBeInTheDocument();
    expect(within(signals).getByRole("link", { name: entry.title })).toHaveAttribute("href", entry.url);
  });

  it("answers an unknown id format with the 404 page", async () => {
    renderApp("/thread/not-an-id");

    expect(await screen.findByRole("heading", { name: "Brak takich akt" })).toBeInTheDocument();
  });
});

describe("Briefing — Threads", () => {
  it("lists active Threads with their lead scenario; the inbox stays hidden from visitors", async () => {
    renderApp("/");

    expect(await screen.findByRole("link", { name: "Cieśnina Ormuz" })).toHaveAttribute("href", "/thread/aaaa0001");
    expect(screen.getByText(/Najbardziej prawdopodobne: Napięcie bez blokady — prawdopodobne/)).toBeInTheDocument();
    expect(screen.queryByText(/Nowe sytuacje/)).not.toBeInTheDocument();
  });

  it("lets the owner accept a New situation", async () => {
    sessionStorage.setItem("foresight.session", JSON.stringify({ accessToken: "access-1", expiresAt: Date.now() + 3_600_000 }));
    const fetchMock = renderApp("/");

    expect(await screen.findByRole("heading", { name: "Wojna w Sudanie" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Akceptuj" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/threads/proposals/bbbb0001",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "accept" }) }),
      ),
    );
  });
});
