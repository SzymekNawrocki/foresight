import { describe, expect, it } from "vitest";
import { validAnalysis } from "../analysis/fixtures.js";
import { eventOf, NOW, threadOf } from "./fixtures.js";
import { createThreadLinks, MAX_PROMPT_THREADS, promptThreads } from "./links.js";
import { InMemoryThreadStore } from "./store.js";

function setup(threads = [threadOf("aaaa0001")]) {
  const store = new InMemoryThreadStore(threads);
  let n = 0;
  const links = createThreadLinks({
    store,
    tierOf: (source) => (source === "un-news" ? "A" : "B"),
    now: () => NOW,
    newId: () => `bbbb000${++n}`,
  });
  return { store, links };
}

describe("promptThreads", () => {
  it("sends active Threads and open proposals, most recent first, without dormant or closed ones", () => {
    const list = [
      threadOf("aaaa0001", { lastEventAt: "2026-10-20T09:00:00.000Z" }),
      threadOf("aaaa0002", { status: "proposed", lastEventAt: "2026-10-21T09:00:00.000Z" }),
      threadOf("aaaa0003", { lastEventAt: "2026-10-01T09:00:00.000Z" }),
      threadOf("aaaa0004", { status: "rejected" }),
      threadOf("aaaa0005", { status: "merged" }),
    ];

    expect(promptThreads(list, NOW)).toEqual([
      { id: "aaaa0002", name: "Wątek aaaa0002" },
      { id: "aaaa0001", name: "Wątek aaaa0001" },
    ]);
  });

  it("caps the list at 30 Threads", () => {
    const list = Array.from({ length: 40 }, (_, i) => threadOf(`aaaa${String(i).padStart(4, "0")}`));

    expect(promptThreads(list, NOW)).toHaveLength(MAX_PROMPT_THREADS);
  });
});

describe("createThreadLinks", () => {
  it("puts an attached Event on the timeline and bumps the Thread's counters", async () => {
    const { store, links } = setup();
    await links.active();

    await links.link(eventOf("a", { source: "un-news" }), { ...validAnalysis, weight: 3, regions: ["global"], thread: { kind: "attach", threadId: "aaaa0001" } });

    expect(store.entries.get("aaaa0001")).toEqual([
      expect.objectContaining({ eventId: "a".repeat(32), tier: "A", weight: 3, linkedAt: NOW.toISOString() }),
    ]);
    expect(store.threads.get("aaaa0001")).toMatchObject({
      eventCount: 4,
      newEvents: 2,
      newWeight: 3,
      lastEventAt: "2026-10-21T10:00:00.000Z",
      regions: ["middle-east", "global"],
    });
  });

  it("opens a New situation once, and further proposals with the same name join it", async () => {
    const { store, links } = setup([]);
    await links.active();
    const propose = { ...validAnalysis, thread: { kind: "propose" as const, name: "Wojna w Sudanie" } };

    await links.link(eventOf("a"), propose);
    await links.link(eventOf("b"), { ...propose, thread: { kind: "propose", name: " wojna w sudanie " } });

    expect([...store.threads.values()]).toEqual([
      expect.objectContaining({ id: "bbbb0001", name: "Wojna w Sudanie", status: "proposed", eventCount: 2, newEvents: 2 }),
    ]);
    expect(store.entries.get("bbbb0001")).toHaveLength(2);
  });

  it("keeps the Topics and Actors of its dispatches on the Thread, so similar proposals can be found", async () => {
    const { store, links } = setup();
    await links.active();

    await links.link(eventOf("a"), { ...validAnalysis, topics: ["drones"], actors: ["ukraine"], thread: { kind: "attach", threadId: "aaaa0001" } });

    expect(store.threads.get("aaaa0001")).toMatchObject({ topics: ["drones"], actors: ["ukraine"] });
  });

  describe("grouping New situations", () => {
    const drones = { ...validAnalysis, topics: ["drones" as const], actors: ["russia" as const, "ukraine" as const] };
    const propose = (name: string) => ({ kind: "propose" as const, name });

    it("joins a differently named proposal that shares a Topic and an Actor, instead of opening a new one", async () => {
      const { store, links } = setup([]);
      await links.active();

      await links.link(eventOf("a"), { ...drones, thread: propose("Wojna dronów nad Ukrainą") });
      await links.link(eventOf("b"), { ...drones, actors: ["russia", "poland"], thread: propose("Rosyjskie drony nad Polską") });

      expect([...store.threads.values()]).toEqual([
        expect.objectContaining({
          id: "bbbb0001",
          name: "Wojna dronów nad Ukrainą",
          eventCount: 2,
          topics: ["drones"],
          actors: ["russia", "ukraine", "poland"],
        }),
      ]);
    });

    it.each([
      ["no shared Actor", { ...drones, actors: ["china" as const] }],
      ["no Actor at all", { ...drones, actors: [] }],
      ["no shared Topic", { ...drones, topics: ["chips" as const] }],
    ])("opens a separate proposal when there is %s", async (_, second) => {
      const { store, links } = setup([]);
      await links.active();

      await links.link(eventOf("a"), { ...drones, thread: propose("Wojna dronów nad Ukrainą") });
      await links.link(eventOf("b"), { ...second, thread: propose("Coś innego") });

      expect(store.threads.size).toBe(2);
    });

    it("does not join a proposal opened more than 7 days ago, nor an active Thread — attaching is the model's call", async () => {
      const old = threadOf("aaaa0001", { status: "proposed", createdAt: "2026-10-13T11:00:00.000Z", topics: ["drones"], actors: ["russia"] });
      const active = threadOf("aaaa0002", { topics: ["drones"], actors: ["russia"] });
      const { store, links } = setup([old, active]);
      await links.active();

      await links.link(eventOf("a"), { ...drones, thread: propose("Wojna dronów nad Ukrainą") });

      expect(store.threads.get("bbbb0001")).toMatchObject({ status: "proposed", eventCount: 1 });
    });
  });

  it("ignores Events without a Thread decision", async () => {
    const { store, links } = setup();
    await links.active();

    await links.link(eventOf("a"), validAnalysis);

    expect(store.entries.size).toBe(0);
  });
});
