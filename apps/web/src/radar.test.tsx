import type { AnalyzedEvent, Thread } from "@foresight/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "./router.js";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let n = 0;
function event(weight: 1 | 2 | 3, hours: number, topic: "cyber" | "space" | "chips" = "cyber"): AnalyzedEvent {
  n++;
  return {
    id: n.toString(16).padStart(32, "0"),
    source: "the-record",
    title: `Event ${n} w${weight} ${topic}`,
    url: `https://therecord.media/${n}`,
    publishedAt: hoursAgo(hours),
    fetchedAt: hoursAgo(0),
    analysis: {
      niche: true,
      regions: ["europe"],
      topics: [topic],
      actors: [],
      companies: [{ company: "CRWD", direction: "up", mechanism: "Popyt na ochronę." }],
      weight,
      whyItMatters: `Dlaczego ${n}.`,
      thread: { kind: "none" },
    },
  };
}

const thread = (over: Partial<Thread> & { id: string; name: string }): Thread & { dormant: boolean } => ({
  status: "active",
  createdAt: hoursAgo(100),
  lastEventAt: hoursAgo(5),
  eventCount: 3,
  newEvents: 0,
  newWeight: 0,
  regions: ["europe"],
  dormant: false,
  ...over,
});

const moved = thread({
  id: "aaaa0001",
  name: "Ataki APT na infrastrukturę",
  newEvents: 2,
  lastEventAt: hoursAgo(1),
  reportedAt: hoursAgo(3),
  lead: { scenario: "Rozrost cyberwojny", likelihood: "prawdopodobne", change: "up" },
  moves: [{ kind: "shift", scenario: "Rozrost cyberwojny", from: "mniej więcej po równo", to: "prawdopodobne" }],
});
const quiet = thread({ id: "aaaa0002", name: "Tajwan i TSMC", reportedAt: hoursAgo(40) });

const proposal: Thread = { ...quiet, id: "bbbb0001", name: "IPO Anthropic", status: "proposed" };

function renderRadar(events: AnalyzedEvent[], threads = [moved, quiet]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/health") return Response.json({ status: "ok" });
      if (url === "/api/config") return Response.json({ auth: { domain: "https://login.example.com", clientId: "client-1" } });
      if (url === "/api/me") return Response.json({ signedIn: true });
      if (url === "/api/recent") return Response.json({ since: hoursAgo(72), events });
      if (url === "/api/threads") return Response.json({ threads });
      if (url === "/api/threads/proposals") return Response.json({ proposals: [{ thread: proposal, timeline: [] }] });
      return new Response("not found", { status: 404 });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: ["/"] }))} />
    </QueryClientProvider>,
  );
}

afterEach(() => sessionStorage.clear());

describe("Radar", () => {
  it("says what it is for", async () => {
    renderRadar([event(2, 1)]);

    expect(await screen.findByRole("heading", { name: "Radar", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Co dziś ważne w Niszy i co nadaje się na post.")).toBeInTheDocument();
  });

  it("counts the last 24 h per Topic, each count opening the filtered Stream", async () => {
    renderRadar([event(2, 1, "cyber"), event(1, 2, "cyber"), event(3, 3, "space"), event(3, 30, "chips")]);

    const bar = within(await screen.findByRole("navigation", { name: "Tematy · 24 h" }));
    expect(bar.getByRole("link", { name: "Cyber 2" })).toHaveAttribute("href", "/stream?topic=cyber");
    expect(bar.getByRole("link", { name: "Kosmos 1" })).toBeInTheDocument();
    expect(bar.getByRole("link", { name: "Chipy 0" })).toBeInTheDocument();
  });

  it("shows up to 8 Events of the last 24 h, heaviest first, then newest", async () => {
    const light = Array.from({ length: 7 }, (_, i) => event(1, i + 1));
    const heavy = event(3, 10);
    const significant = event(2, 9);
    const old = event(3, 30);
    renderRadar([...light, heavy, significant, old]);

    const list = within(await screen.findByRole("region", { name: /Najważniejsze dziś/ }));
    const titles = (await list.findAllByRole("heading", { level: 3 })).map((h) => h.textContent);
    expect(titles).toHaveLength(8);
    expect(titles.slice(0, 3)).toEqual([heavy.title, significant.title, light[0]?.title]);
    expect(titles).not.toContain(old.title);
    expect(list.getAllByRole("list", { name: "Spółki" })).toHaveLength(8);
  });

  it("lists the Threads that moved with their new Events, leaving quiet ones out", async () => {
    renderRadar([event(2, 1)]);

    const panel = within(await screen.findByRole("region", { name: /Wątki w ruchu/ }));
    expect(panel.getByRole("link", { name: moved.name })).toHaveAttribute("href", "/thread/aaaa0001");
    expect(panel.getByText("+2 nowe")).toBeInTheDocument();
    expect(panel.getByText(/Rozrost cyberwojny/)).toBeInTheDocument();
    expect(panel.queryByRole("link", { name: quiet.name })).toBeNull();
  });

  it("lists the Moves of the last 24 h", async () => {
    renderRadar([event(2, 1)]);

    const moves = within(await screen.findByRole("region", { name: /Ruchy · 24 h/ }));
    expect(moves.getByText(/Rozrost cyberwojny — mniej więcej po równo →/)).toHaveTextContent("prawdopodobne");
  });

  it("offers the owner a shortcut to the Inbox", async () => {
    sessionStorage.setItem("foresight.session", JSON.stringify({ accessToken: "access-1", expiresAt: Date.now() + 3_600_000 }));
    renderRadar([event(2, 1)]);

    expect(await screen.findByRole("link", { name: /Nowe sytuacje czekają na decyzję: 1/ })).toHaveAttribute("href", "/inbox");
  });

  it("explains an empty day: the worker runs hourly, and when it last brought an Event", async () => {
    renderRadar([event(2, 30)], [quiet]);

    expect(await screen.findByText(/W ostatnich 24 h nie ma Zdarzeń z Niszy/)).toHaveTextContent(
      "Worker analizuje nowe Zdarzenia co godzinę; ostatnie Zdarzenie: przed chwilą.",
    );
    expect(screen.getByText("Żaden Wątek nie dostał dziś nowych Zdarzeń.")).toBeInTheDocument();
  });

  it("has no map", async () => {
    renderRadar([event(2, 1)]);

    await screen.findByRole("heading", { name: "Radar", level: 1 });
    expect(screen.queryByRole("img", { name: "Mapa Regionów" })).toBeNull();
  });
});
