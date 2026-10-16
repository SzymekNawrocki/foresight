import type { Thesis } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { accuracy, score } from "./score.js";

const t = (over: Partial<Thesis>): Thesis => ({
  id: "2026-10-16T12:00:00.000Z#0a1b2c3d",
  eventId: "0123456789abcdef0123456789abcdef",
  eventTitle: "Title",
  instrument: "BNO",
  direction: "up",
  horizonDays: 7,
  rationale: "Uzasadnienie dłuższe niż dziesięć znaków.",
  regions: ["middle-east"],
  topics: ["energy"],
  createdAt: "2026-10-16T12:00:00.000Z",
  resolveAt: "2026-10-23T12:00:00.000Z",
  status: "open",
  ...over,
});

describe("score", () => {
  const theses = [
    t({ status: "resolved", hit: true, regions: ["middle-east", "europe"], topics: ["energy"] }),
    t({ status: "resolved", hit: false, regions: ["europe"], topics: ["battlefield"] }),
    t({ status: "resolved", hit: true, regions: ["europe"], topics: ["energy"] }),
    t({ status: "open" }),
  ];

  it("counts only resolved Theses into accuracy", () => {
    expect(score(theses).overall).toEqual({ resolved: 3, hits: 2, open: 1 });
  });

  it("splits accuracy per Region and per Topic", () => {
    const s = score(theses);
    expect(s.regions.europe).toEqual({ resolved: 3, hits: 2, open: 0 });
    expect(s.regions["middle-east"]).toEqual({ resolved: 1, hits: 1, open: 1 });
    expect(s.topics.energy).toEqual({ resolved: 2, hits: 2, open: 1 });
    expect(s.topics.cyber).toEqual({ resolved: 0, hits: 0, open: 0 });
  });

  it("shows accuracy as a percentage, or a dash with nothing resolved", () => {
    expect(accuracy({ resolved: 3, hits: 2, open: 0 })).toBe("67%");
    expect(accuracy({ resolved: 0, hits: 0, open: 4 })).toBe("—");
  });
});
