import { z } from "zod";
import { AnalyzedEvent } from "./analysis.js";

// GET /api/recent — every Event of the last hours, newest first. Feeds the Briefing (map counters)
// and the Knowledge base pages, which filter it by Region or Topic on the page.
export const RecentResponse = z.object({
  since: z.iso.datetime(),
  events: z.array(AnalyzedEvent).max(500),
});

export type RecentResponse = z.infer<typeof RecentResponse>;
