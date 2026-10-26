import type { AnalyzedEvent } from "@foresight/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAppRouter } from "./router.js";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let n = 0;
function event(title: string, weight: 1 | 2 | 3, region: "europe" | "north-america" | "middle-east", topic: "cyber" | "space" | "drones"): AnalyzedEvent {
  n++;
  return {
    id: n.toString(16).padStart(32, "0"),
    source: "the-record",
    title,
    url: `https://therecord.media/${n}`,
    publishedAt: hoursAgo(n),
    fetchedAt: hoursAgo(0),
    analysis: {
      niche: true,
      regions: [region],
      topics: [topic],
      actors: [],
      companies: [{ company: "CRWD", direction: "up", mechanism: `Mechanizm ${title}.` }],
      weight,
      whyItMatters: `Dlaczego ${title}.`,
      thread: { kind: "none" },
    },
  };
}

const camera = event("Hackers exploit cameras", 2, "europe", "cyber");
const launch = event("Dedicated launch contract", 1, "north-america", "space");
const strike = event("Drone strike on missile site", 3, "middle-east", "drones");
const leak = event("AI tool leaked a key", 1, "europe", "cyber");

function renderStream(path = "/stream") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/health") return Response.json({ status: "ok" });
      if (url === "/api/config") return Response.json({ auth: null });
      if (url === "/api/recent") return Response.json({ since: hoursAgo(72), events: [camera, launch, strike, leak] });
      if (url === "/api/threads") return Response.json({ threads: [] });
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

const listed = () =>
  within(screen.getByRole("list", { name: "Zdarzenia" }))
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);

describe("Stream", () => {
  it("shows the map straight away, tinted by Event count, with Breakthrough marked", async () => {
    renderStream();

    expect(await screen.findByRole("img", { name: "Mapa Regionów" })).toBeInTheDocument();
    const map = within(screen.getByRole("group", { name: "Regiony na mapie" }));
    expect(map.getByRole("button", { name: /Europa/ })).toHaveTextContent(/^Europa2$/);
    expect(map.getByRole("button", { name: /Bliski Wschód/ })).toHaveTextContent("Bliski Wschód1w tym Przełomowe");
    expect(map.getByRole("button", { name: /Europa/ })).not.toHaveTextContent("Przełomowe");
  });

  it("lists every Event, newest first, with a count", async () => {
    renderStream();

    await screen.findByRole("list", { name: "Zdarzenia" });
    expect(listed()).toEqual([camera.title, launch.title, strike.title, leak.title]);
    expect(screen.getByText("4 Zdarzenia")).toBeInTheDocument();
  });

  it("filters by Region on a map click and clears on the second click", async () => {
    const router = renderStream();

    const map = within(await screen.findByRole("group", { name: "Regiony na mapie" }));
    fireEvent.click(map.getByRole("button", { name: /Europa/ }));
    await waitFor(() => expect(router.state.location.search).toEqual({ region: "europe" }));
    expect(listed()).toEqual([camera.title, leak.title]);
    expect(map.getByRole("button", { name: /Europa/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(map.getByRole("button", { name: /Europa/ }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(listed()).toHaveLength(4);
  });

  it("offers a Region select for small screens", async () => {
    const router = renderStream();

    fireEvent.change(await screen.findByRole("combobox", { name: "Region" }), { target: { value: "north-america" } });
    await waitFor(() => expect(router.state.location.search).toEqual({ region: "north-america" }));
    expect(listed()).toEqual([launch.title]);
  });

  it("filters by several Topics at once, kept in the address", async () => {
    const router = renderStream();

    const topics = within(await screen.findByRole("group", { name: "Tematy" }));
    fireEvent.click(topics.getByRole("button", { name: "Cyber" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ topic: "cyber" }));
    fireEvent.click(topics.getByRole("button", { name: "Kosmos" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ topic: "cyber,space" }));
    expect(topics.getByRole("button", { name: "Cyber" })).toHaveAttribute("aria-pressed", "true");
    expect(listed()).toEqual([camera.title, launch.title, leak.title]);
  });

  it("filters by Weight", async () => {
    const router = renderStream();

    const weight = within(await screen.findByRole("group", { name: "Waga" }));
    fireEvent.click(weight.getByRole("button", { name: "Istotne i wyżej" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ weight: 2 }));
    expect(listed()).toEqual([camera.title, strike.title]);

    fireEvent.click(weight.getByRole("button", { name: "Przełomowe" }));
    await waitFor(() => expect(listed()).toEqual([strike.title]));
  });

  it("restores the filters from the address after a reload", async () => {
    renderStream("/stream?region=europe&topic=cyber&weight=2");

    await screen.findByRole("list", { name: "Zdarzenia" });
    expect(listed()).toEqual([camera.title]);
    expect(within(screen.getByRole("group", { name: "Tematy" })).getByRole("button", { name: "Cyber" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "Waga" })).getByRole("button", { name: "Istotne i wyżej" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says what to do when nothing matches", async () => {
    const router = renderStream("/stream?region=north-america&weight=3");

    expect(await screen.findByText("Żadne Zdarzenie nie pasuje do filtrów.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it("keeps cards compact: Companies and why it matters open on click", async () => {
    renderStream();

    const card = (await screen.findByRole("link", { name: camera.title })).closest("article") as HTMLElement;
    const c = within(card);
    expect(c.queryByText(`Dlaczego ${camera.title}.`)).toBeNull();
    const toggle = c.getByRole("button", { name: "Szczegóły" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(c.getByText(`Dlaczego ${camera.title}.`)).toBeInTheDocument();
    expect(c.getByRole("list", { name: "Spółki" })).toBeInTheDocument();
  });
});
