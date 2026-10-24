import type { AnalyzedEvent } from "@foresight/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "./router.js";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const analysis = {
  regions: ["middle-east", "europe"],
  topics: ["energy", "sanctions-trade"],
  actors: ["iran", "eu"],
  weight: 3,
  whyItMatters: "Ormuz to wąskie gardło dla ropy, więc każde zakłócenie od razu trafia w ceny.",
  thread: { kind: "none" },
} as const;

// Saved before slice 10: one Scenario per Event, no Actors.
const legacyAnalysis = {
  regions: ["europe"],
  topics: ["energy"],
  weight: 2,
  whyItMatters: "Gaz drożeje. Przemysł to odczuje.",
  scenario: {
    escalation: { path: "Blokada cieśniny na kilka dni.", assetClass: "ropa", direction: "up" },
    deescalation: { path: "Rozmowy uspokajają rynek.", assetClass: "ropa", direction: "down" },
  },
};

const hormuz: AnalyzedEvent = {
  id: "0123456789abcdef0123456789abcdef",
  source: "al-jazeera",
  title: "Iran threatens to close the Strait of Hormuz",
  url: "https://www.aljazeera.com/news/1",
  publishedAt: hoursAgo(1),
  fetchedAt: hoursAgo(0),
  analysis: { ...analysis, regions: [...analysis.regions], topics: [...analysis.topics], actors: [...analysis.actors] },
};

const pending: AnalyzedEvent = {
  id: "fedcba9876543210fedcba9876543210",
  source: "bbc-world",
  title: "Chip export talks resume",
  url: "https://www.bbc.co.uk/news/2",
  publishedAt: hoursAgo(2),
  fetchedAt: hoursAgo(0),
};

const signInAsOwner = () =>
  sessionStorage.setItem("foresight.session", JSON.stringify({ accessToken: "access-1", expiresAt: Date.now() + 3_600_000 }));

function renderApp(path: string, recent: unknown = { since: hoursAgo(72), events: [hormuz, pending] }, status = 200) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/health") return Response.json({ status: "ok" });
    if (url === "/api/config") return Response.json({ auth: { domain: "https://login.example.com", clientId: "client-1" } });
    if (url === "/api/me") return new Headers(init?.headers).get("x-foresight-token") === "access-1" ? Response.json({ signedIn: true }) : new Response("{}", { status: 401 });
    if (url === "/api/recent") return status === 200 ? Response.json(recent) : new Response("boom", { status });
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { fetchMock, router };
}

describe("Stream", () => {
  it("shows the 24 h totals and a counter per Region on the map", async () => {
    renderApp("/stream");

    expect(await screen.findByRole("heading", { name: "Strumień · 24 h" })).toBeInTheDocument();
    const map = within(screen.getByRole("navigation", { name: "Regiony na mapie" }));
    const middleEast = map.getByRole("link", { name: /Bliski Wschód/ });
    expect(middleEast).toHaveTextContent("01");
    expect(middleEast).toHaveAttribute("href", "/region/middle-east");
    expect(map.getByRole("link", { name: /Ameryka Północna/ })).toHaveTextContent("00");
  });

  it("shows in the footer how fresh the data is, with the AI disclaimer", async () => {
    renderApp("/stream");

    const footer = within(await screen.findByRole("contentinfo"));
    expect(await footer.findByText("ostatnie Zdarzenie: przed chwilą")).toBeInTheDocument();
    expect(footer.getByText(/to nie jest porada inwestycyjna/)).toBeInTheDocument();
  });

  it("reports the link to the API in the header", async () => {
    renderApp("/stream");

    expect(await screen.findByText("Łącze: aktywne")).toBeInTheDocument();
  });

  it("shows an error when the API breaks the contract", async () => {
    renderApp("/stream", { since: hoursAgo(72), events: [{ ...pending, url: "javascript:alert(1)" }] });

    expect(await screen.findByText("Nie udało się pobrać Zdarzeń.")).toBeInTheDocument();
  });

  it("shows an error when the API fails", async () => {
    renderApp("/stream", undefined, 500);

    expect(await screen.findByText("Nie udało się pobrać Zdarzeń.")).toBeInTheDocument();
  });
});

describe("Event card", () => {
  it("shows the Analysis in Polish: Weight, Regions, Topics, Actors and why it matters", async () => {
    renderApp("/region/middle-east");

    const card = (await screen.findByRole("link", { name: hormuz.title })).closest("article");
    if (!card) throw new Error("no card");
    const c = within(card);
    expect(c.getByText("Waga 3 · przełomowe")).toBeInTheDocument();
    expect(c.getByRole("link", { name: "Bliski Wschód" })).toHaveAttribute("href", "/region/middle-east");
    // An old Topic stays readable but has no page since the Niche (ADR 0010).
    expect(c.getByText("Sankcje i handel")).toBeInTheDocument();
    expect(c.queryByRole("link", { name: "Sankcje i handel" })).toBeNull();
    expect(within(c.getByRole("list", { name: "Aktorzy" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Iran",
      "UE",
    ]);
    expect(c.getByText(analysis.whyItMatters)).toBeInTheDocument();
    expect(c.queryByText(/Eskalacja/)).not.toBeInTheDocument();
  });

  it("names the Companies a dispatch may move, with an arrow and the mechanism", async () => {
    const nicheAnalysis = {
      niche: true as const,
      regions: ["europe" as const],
      topics: ["cyber" as const],
      actors: ["russia" as const],
      companies: [
        { company: "CRWD" as const, direction: "up" as const, mechanism: "Popyt na ochronę po ataku." },
        { company: "NVDA" as const, direction: "uncertain" as const, mechanism: "Nie wiadomo, czy ucierpią dostawy." },
      ],
      weight: 2 as const,
      whyItMatters: "Atak na sieć energetyczną.",
      thread: { kind: "none" as const },
    };
    renderApp("/region/europe", { since: hoursAgo(72), events: [{ ...pending, analysis: nicheAnalysis }] });

    const card = (await screen.findByRole("link", { name: pending.title })).closest("article");
    if (!card) throw new Error("no card");
    const items = within(within(card).getByRole("list", { name: "Spółki" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "CrowdStrike (CRWD) ↑ Popyt na ochronę po ataku.",
      "Nvidia (NVDA) ? Nie wiadomo, czy ucierpią dostawy.",
    ]);
  });

  it("still shows both Branches of an Analysis saved in the legacy shape", async () => {
    renderApp("/region/europe", { since: hoursAgo(72), events: [{ ...pending, analysis: legacyAnalysis }] });

    const card = (await screen.findByRole("link", { name: pending.title })).closest("article");
    if (!card) throw new Error("no card");
    const c = within(card);
    expect(c.getByText(/Eskalacja: ropa/)).toHaveTextContent("Eskalacja: ropa ↑");
    expect(c.getByText(/Deeskalacja: ropa/)).toHaveTextContent("Deeskalacja: ropa ↓");
    expect(c.getByText(legacyAnalysis.scenario.escalation.path)).toBeInTheDocument();
    expect(c.queryByRole("list", { name: "Aktorzy" })).not.toBeInTheDocument();
  });

  it("links out safely to the source article", async () => {
    renderApp("/stream");

    const [link] = await screen.findAllByRole("link", { name: hormuz.title });
    expect(link).toHaveAttribute("href", hormuz.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("marks an Event that is still waiting for its Analysis", async () => {
    renderApp("/stream");

    expect(await screen.findByText(/Analiza w kolejce/)).toBeInTheDocument();
  });

  it("renders feed and LLM text as text, never as HTML", async () => {
    const evil = '<img src=x onerror="alert(1)">';
    renderApp("/stream", {
      since: hoursAgo(72),
      events: [{ ...hormuz, title: evil, analysis: { ...hormuz.analysis, whyItMatters: evil } }],
    });

    expect((await screen.findAllByText(evil)).length).toBeGreaterThan(0);
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("Knowledge base", () => {
  it("lists only the Events of one Region", async () => {
    renderApp("/region/europe");

    expect(await screen.findByRole("heading", { name: "Europa" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hormuz.title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: pending.title })).toBeNull();
  });

  it("lists only the Events of one Topic", async () => {
    renderApp("/topic/ai");

    expect(await screen.findByRole("heading", { name: "AI" })).toBeInTheDocument();
    expect(screen.getByText("Brak Zdarzeń w tym obszarze w ostatnich 72 h.")).toBeInTheDocument();
  });

  it("answers 404 for an unknown Region instead of trusting the address", async () => {
    renderApp("/region/atlantis");

    expect(await screen.findByText("Brak takich akt")).toBeInTheDocument();
  });
});

describe("Login", () => {
  afterEach(() => sessionStorage.clear());

  it("offers a login button to a visitor", async () => {
    renderApp("/stream");

    expect(await screen.findByRole("button", { name: "Zaloguj" })).toBeInTheDocument();
  });

  it("confirms the owner session against the API and offers logout", async () => {
    signInAsOwner();
    renderApp("/stream");

    expect(await screen.findByText("Właściciel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wyloguj" })).toBeInTheDocument();
  });
});
