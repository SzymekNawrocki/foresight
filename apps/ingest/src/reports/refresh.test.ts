import type { Thread } from "@foresight/shared";
import { describe, expect, it, vi } from "vitest";
import { createTokenBudget, InMemoryBudgetStore } from "../budget/budget.js";
import { createFakeLlm, type FakeReply } from "../llm/fake.js";
import { entryOf, NOW, reportOf, threadOf } from "../threads/fixtures.js";
import { InMemoryThreadStore } from "../threads/store.js";
import { createSituationReports, dueThreads } from "./refresh.js";

const LANE = "reports";
const valid: FakeReply = {
  answer: {
    state: "Stan.",
    actors: [],
    scenarios: [
      { kind: "escalation", name: "E", description: "d", likelihood: "mało prawdopodobne", signals: [{ text: "Sygnał", evidence: "e1" }] },
      { kind: "status-quo", name: "S", description: "d", likelihood: "prawdopodobne", signals: [] },
      { kind: "deescalation", name: "D", description: "d", likelihood: "mało prawdopodobne", signals: [] },
    ],
    assets: [],
    relations: "r",
    whatChanged: "w",
  },
};

function setup(threads: Thread[], replies: FakeReply[] = [valid, valid, valid], tokenLimit = 1_000_000) {
  const entries = Object.fromEntries(threads.map((t) => [t.id, [entryOf("a"), entryOf("b", { linkedAt: "2026-10-19T00:00:00.000Z" })]]));
  const store = new InMemoryThreadStore(threads, entries);
  const llm = createFakeLlm(replies);
  const sleep = vi.fn(async () => {});
  const budget = createTokenBudget({ store: new InMemoryBudgetStore(), limits: { [LANE]: tokenLimit }, now: () => NOW });
  const reports = createSituationReports({ store, llm: async () => llm, lane: LANE, limit: 2, pauseMs: 60_000, sleep, now: () => NOW });
  return { store, llm, sleep, budget, reports };
}

describe("dueThreads", () => {
  it("takes active Threads with new Events and no report in 24 h, highest new Weight first", () => {
    const list = [
      threadOf("aaaa0001", { newWeight: 2 }),
      threadOf("aaaa0002", { newWeight: 3 }),
      threadOf("aaaa0003", { newEvents: 0 }),
      threadOf("aaaa0004", { reportedAt: "2026-10-21T00:00:00.000Z" }),
      threadOf("aaaa0005", { reportedAt: "2026-10-20T11:00:00.000Z" }),
      threadOf("aaaa0006", { status: "proposed" }),
      threadOf("aaaa0007", { lastEventAt: "2026-10-01T00:00:00.000Z" }),
    ];

    expect(dueThreads(list, NOW).map((t) => t.id)).toEqual(["aaaa0002", "aaaa0001", "aaaa0005"]);
  });
});

describe("refreshDue", () => {
  it("writes a report per due Thread, at most `limit` per run, pausing between calls", async () => {
    const { store, llm, sleep, budget, reports } = setup([threadOf("aaaa0001"), threadOf("aaaa0002"), threadOf("aaaa0003")]);

    await expect(reports.refreshDue(budget)).resolves.toEqual({ refreshed: 2, failed: 0, due: 1 });
    expect(llm.requests).toHaveLength(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(store.reports.get("aaaa0001")?.[0]).toMatchObject({ createdAt: NOW.toISOString(), basedOn: 2 });
    expect(store.threads.get("aaaa0001")).toMatchObject({ newEvents: 0, newWeight: 0, reportedAt: NOW.toISOString() });
    expect(store.threads.get("aaaa0001")?.lead).toEqual({ scenario: "S", likelihood: "prawdopodobne", change: "new" });
  });

  it("sends only the entries added since the previous version", async () => {
    const { store, llm, budget, reports } = setup([threadOf("aaaa0001", { reportedAt: "2026-10-20T08:00:00.000Z" })]);
    store.reports.set("aaaa0001", [reportOf()]);

    await reports.refreshDue(budget);

    expect(llm.requests[0]?.messages[1]?.content).toContain("Event a");
    expect(llm.requests[0]?.messages[1]?.content).not.toContain("Event b");
  });

  it("spends from its own lane and stops before the lane's limit", async () => {
    const { llm, budget, reports } = setup([threadOf("aaaa0001")], [valid], 100);

    await expect(reports.refreshDue(budget)).resolves.toEqual({ refreshed: 0, failed: 0, due: 1, stopped: "budget" });
    expect(llm.requests).toHaveLength(0);
  });

  it("counts an answer that does not settle into a report, and stops on a 429", async () => {
    const { store, budget, reports } = setup(
      [threadOf("aaaa0001", { newWeight: 3 }), threadOf("aaaa0002")],
      [{ answer: { ...(valid as { answer: object }).answer, scenarios: [] } }, { fail: "rate-limited" }],
    );

    await expect(reports.refreshDue(budget)).resolves.toEqual({
      refreshed: 0,
      failed: 2,
      due: 2,
      reasons: { unsettled: 1, "rate-limited": 1 },
      stopped: "rate-limited",
    });
    expect(store.reports.size).toBe(0);
  });

  it("does not open the LLM when nothing is due", async () => {
    const open = vi.fn();
    const reports = createSituationReports({ store: new InMemoryThreadStore(), llm: open, now: () => NOW });

    await expect(reports.refreshDue(createTokenBudget({ store: new InMemoryBudgetStore(), limits: {} }))).resolves.toEqual({
      refreshed: 0,
      failed: 0,
      due: 0,
    });
    expect(open).not.toHaveBeenCalled();
  });
});
