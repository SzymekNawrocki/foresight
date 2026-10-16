import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventList } from "./EventList.js";

const event = {
  id: "0123456789abcdef0123456789abcdef",
  source: "bbc-world",
  title: "Ceasefire talks resume",
  url: "https://www.bbc.co.uk/news/articles/x1",
  publishedAt: "2026-10-12T16:44:07.000Z",
  fetchedAt: "2026-10-12T18:00:00.000Z",
};

const analysis = {
  regions: ["middle-east", "europe"],
  topics: ["energy", "sanctions-trade"],
  weight: 3,
  whyItMatters: "Ormuz to wąskie gardło dla ropy. Każde zakłócenie od razu trafia w ceny.",
  scenario: {
    escalation: { path: "Blokada cieśniny na kilka dni.", assetClass: "ropa", direction: "up" },
    deescalation: { path: "Rozmowy uspokajają rynek.", assetClass: "ropa", direction: "down" },
  },
};

function renderWithApi(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EventList />
    </QueryClientProvider>,
  );
  return fetchMock;
}

describe("EventList", () => {
  it("asks the API for the latest Events", async () => {
    const fetchMock = renderWithApi(Response.json({ events: [] }));

    await screen.findByText("Brak Zdarzeń.");
    expect(fetchMock).toHaveBeenCalledWith("/api/events");
  });

  it("lists each Event as a safe external link with its Source and time", async () => {
    renderWithApi(Response.json({ events: [event] }));

    const link = await screen.findByRole("link", { name: "Ceasefire talks resume" });
    expect(link).toHaveAttribute("href", event.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("bbc-world")).toBeInTheDocument();
    expect(screen.getByText("12.10.2026, 18:44")).toBeInTheDocument();
  });

  it("renders feed text as text, never as HTML", async () => {
    const title = '<img src=x onerror="alert(1)">';
    renderWithApi(Response.json({ events: [{ ...event, title }] }));

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows the Analysis in Polish: Weight, Regions, Topics, why it matters and both Branches", async () => {
    renderWithApi(Response.json({ events: [{ ...event, analysis }] }));

    expect(await screen.findByText("Waga 3 · przełomowe")).toBeInTheDocument();
    expect(screen.getByText("Bliski Wschód, Europa")).toBeInTheDocument();
    expect(screen.getByText("Energia, Sankcje i handel")).toBeInTheDocument();
    expect(screen.getByText(analysis.whyItMatters)).toBeInTheDocument();
    expect(screen.getByText("Eskalacja: ropa ↑")).toBeInTheDocument();
    expect(screen.getByText("Deeskalacja: ropa ↓")).toBeInTheDocument();
    expect(screen.getByText(analysis.scenario.escalation.path)).toBeInTheDocument();
  });

  it("marks an Event that is still waiting for its Analysis", async () => {
    renderWithApi(Response.json({ events: [event] }));

    expect(await screen.findByText("Analiza w kolejce")).toBeInTheDocument();
  });

  it("renders LLM text as text, never as HTML", async () => {
    const whyItMatters = '<img src=x onerror="alert(1)">';
    renderWithApi(Response.json({ events: [{ ...event, analysis: { ...analysis, whyItMatters } }] }));

    expect(await screen.findByText(whyItMatters)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows an error when the response breaks the contract", async () => {
    renderWithApi(Response.json({ events: [{ ...event, url: "javascript:alert(1)" }] }));

    expect(await screen.findByText("Nie udało się pobrać Zdarzeń.")).toBeInTheDocument();
  });

  it("shows an error when the API responds with a server error", async () => {
    renderWithApi(new Response("boom", { status: 500 }));

    expect(await screen.findByText("Nie udało się pobrać Zdarzeń.")).toBeInTheDocument();
  });
});
