import type { Event, SituationReport, Thread, TimelineEntry } from "@foresight/shared";

export const NOW = new Date("2026-10-21T12:00:00.000Z");

export const threadOf = (id: string, overrides: Partial<Thread> = {}): Thread => ({
  id,
  name: `Wątek ${id}`,
  status: "active",
  createdAt: "2026-10-18T10:00:00.000Z",
  lastEventAt: "2026-10-21T09:00:00.000Z",
  eventCount: 3,
  newEvents: 1,
  newWeight: 2,
  regions: ["middle-east"],
  ...overrides,
});

export const eventOf = (letter: string, overrides: Partial<Event> = {}): Event => ({
  id: letter.repeat(32),
  source: "bbc-world",
  title: `Event ${letter}`,
  url: `https://www.bbc.com/news/${letter}`,
  publishedAt: "2026-10-21T10:00:00.000Z",
  fetchedAt: "2026-10-21T11:00:00.000Z",
  ...overrides,
});

export const entryOf = (letter: string, overrides: Partial<TimelineEntry> = {}): TimelineEntry => ({
  eventId: letter.repeat(32),
  title: `Event ${letter}`,
  url: `https://www.bbc.com/news/${letter}`,
  source: "bbc-world",
  tier: "B",
  publishedAt: "2026-10-21T10:00:00.000Z",
  linkedAt: "2026-10-21T11:00:00.000Z",
  weight: 2,
  whyItMatters: "Ważne dla ropy.",
  actors: ["iran"],
  regions: ["middle-east"],
  ...overrides,
});

export const reportOf = (overrides: Partial<SituationReport> = {}): SituationReport => ({
  createdAt: "2026-10-20T08:00:00.000Z",
  model: "openai/gpt-oss-120b",
  state: "Napięcie w cieśninie.",
  actors: [{ name: "Iran", interest: "Presja na sankcje." }],
  scenarios: [
    {
      kind: "escalation",
      name: "Blokada",
      description: "Iran zamyka cieśninę.",
      likelihood: "mało prawdopodobne",
      change: "new",
      reason: "pierwsza ocena: mało prawdopodobne",
      signals: [
        { text: "Iran ogłasza ćwiczenia", lit: false },
        {
          text: "Atak na tankowiec",
          lit: true,
          evidence: { eventId: "f".repeat(32), title: "Tanker hit", url: "https://www.bbc.com/news/z", source: "bbc-world", tier: "B" },
          litAt: "2026-10-20T08:00:00.000Z",
        },
      ],
    },
    {
      kind: "status-quo",
      name: "Napięcie bez blokady",
      description: "Incydenty bez zamknięcia.",
      likelihood: "prawdopodobne",
      change: "new",
      reason: "pierwsza ocena: prawdopodobne",
      signals: [],
    },
    {
      kind: "deescalation",
      name: "Rozmowy",
      description: "Powrót do rozmów.",
      likelihood: "mało prawdopodobne",
      change: "new",
      reason: "pierwsza ocena: mało prawdopodobne",
      signals: [],
    },
  ],
  mostLikely: "status-quo",
  assets: [{ name: "ropa", direction: "up", why: "Ryzyko podaży." }],
  relations: "Napięcie USA–Iran.",
  whatChanged: "Pierwsza wersja.",
  basedOn: 3,
  rejectedSignals: 0,
  ...overrides,
});
