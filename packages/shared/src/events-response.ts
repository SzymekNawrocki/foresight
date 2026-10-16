import { z } from "zod";
import { AnalyzedEvent } from "./analysis.js";

// GET /api/events — the latest Events, newest first, each with its Analysis when it has one.
export const EventsResponse = z.object({
  events: z.array(AnalyzedEvent).max(50),
});

export type EventsResponse = z.infer<typeof EventsResponse>;
