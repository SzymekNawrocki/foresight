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
  topics: ["drones", "chips"],
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

const quiet: Thread = { ...thread, id: "aaaa0002", name: "Tajwan – chipy", lastEventAt: hoursAgo(0.5), lead: undefined, moves: undefined };
const asleep: Thread = { ...thread, id: "aaaa0003", name: "Arktyka", lastEventAt: hoursAgo(24 * 20) };

function renderApp(path: string, listed: (Thread & { dormant?: boolean })[] = [thread]) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/health") return Response.json({ status: "ok" });
    if (url === "/api/config") return Response.json({ auth: { domain: "https://login.example.com", clientId: "client-1" } });
    if (url === "/api/me") return Response.json({ signedIn: true });
    if (url === "/api/recent") return Response.json({ since: hoursAgo(72), events: [] });
    if (url === "/api/threads") return Response.json({ threads: listed.map((t) => ({ dormant: false, ...t })) });
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

  it("has a table of contents that links to each section of the page", async () => {
    renderApp("/thread/aaaa0001");

    const toc = within(await screen.findByRole("navigation", { name: "Spis treści" }));
    const links = toc.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Stan teraz", "Scenariusze", "Aktorzy", "Rynki", "Oś czasu"]);
    for (const link of links) {
      const target = document.getElementById(link.getAttribute("href")?.slice(1) ?? "");
      expect(target).toHaveAccessibleName(new RegExp(`^${link.textContent}`));
    }
  });

  it("puts the timeline entries on a line with their Weight in words", async () => {
    renderApp("/thread/aaaa0001");

    const timeline = within(await screen.findByRole("list", { name: "Oś czasu" }));
    expect(timeline.getByRole("link", { name: entry.title })).toHaveAttribute("href", entry.url);
    expect(timeline.getByText(/Waga 3 \(przełomowe\)/)).toBeInTheDocument();
  });

  it("answers an unknown id format with the 404 page", async () => {
    renderApp("/thread/not-an-id");

    expect(await screen.findByRole("heading", { name: "Brak takich akt" })).toBeInTheDocument();
  });
});

describe("Threads page", () => {
  it("shows a card per active Thread, those with new Events first, with a +N new badge", async () => {
    renderApp("/threads", [quiet, { ...thread, newEvents: 2 }]);

    const grid = within(await screen.findByRole("list", { name: "Wątki aktywne" }));
    const cards = grid.getAllByRole("article");
    expect(cards.map((c) => within(c).getByRole("heading").textContent)).toEqual(["Cieśnina Ormuz", "Tajwan – chipy"]);
    const lead = within(cards[0] as HTMLElement);
    expect(lead.getByRole("link", { name: "Cieśnina Ormuz" })).toHaveAttribute("href", "/thread/aaaa0001");
    expect(lead.getByText("+2 nowe")).toBeInTheDocument();
    expect(lead.getByText(/Napięcie bez blokady — prawdopodobne/)).toBeInTheDocument();
    expect(lead.getByText("↑ rośnie")).toBeInTheDocument();
    expect(lead.getByText("Chipy")).toBeInTheDocument();
    expect(lead.getByText("Drony")).toBeInTheDocument();
    expect(lead.getByText(/Bliski Wschód/)).toBeInTheDocument();
    const second = within(cards[1] as HTMLElement);
    expect(second.queryByText(/nowe$/)).not.toBeInTheDocument();
    expect(second.getByText("Raport sytuacyjny w przygotowaniu")).toBeInTheDocument();
    expect(screen.queryByText(/Nowe sytuacje/)).not.toBeInTheDocument();
  });

  it("folds dormant Threads into a collapsed section at the bottom", async () => {
    renderApp("/threads", [thread, { ...asleep, dormant: true }]);

    const toggle = await screen.findByText("Uśpione · 1");
    const sleeper = screen.getByRole("link", { name: "Arktyka" });
    expect(sleeper).not.toBeVisible();
    fireEvent.click(toggle);
    expect(sleeper).toBeVisible();
  });
});

describe("Threads and Radar", () => {
  it("shows the Moves of the last 24 h on the Radar", async () => {
    renderApp("/");

    const moves = within(await screen.findByRole("region", { name: /Ruchy · 24 h/ }));
    expect(await moves.findByText(/Napięcie bez blokady — mniej więcej po równo →/)).toHaveTextContent("prawdopodobne");
  });

  it("says so when nothing moved in 24 h", async () => {
    renderApp("/", [{ ...thread, reportedAt: hoursAgo(30) }]);

    expect(await screen.findByText("Bez zmian w Raportach z ostatnich 24 h.")).toBeInTheDocument();
  });

  it("lets the owner accept a New situation in the Inbox", async () => {
    sessionStorage.setItem("foresight.session", JSON.stringify({ accessToken: "access-1", expiresAt: Date.now() + 3_600_000 }));
    const fetchMock = renderApp("/inbox");

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

describe("Stream filtered to a Region — Threads", () => {
  it("lists the active Threads of the Region above its Events", async () => {
    renderApp("/region/middle-east");

    const panel = within(await screen.findByRole("region", { name: /Wątki w tym Regionie/ }));
    expect(panel.getByRole("link", { name: "Cieśnina Ormuz" })).toBeInTheDocument();
  });
});
