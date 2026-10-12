import { z } from "zod";
import { Event } from "./event.js";

// GET /api/events — the latest Events, newest first.
export const EventsResponse = z.object({
  events: z.array(Event).max(50),
});

export type EventsResponse = z.infer<typeof EventsResponse>;
