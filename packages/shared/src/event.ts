import { z } from "zod";

// An Event (CONTEXT.md: Zdarzenie) — one item taken from a Source. Feed content is untrusted,
// so every field is bounded and the link must be https.
export const Event = z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  source: z.string().min(1).max(40),
  title: z.string().min(1).max(300),
  url: z.url({ protocol: /^https$/ }).max(2048),
  publishedAt: z.iso.datetime(),
  fetchedAt: z.iso.datetime(),
});

export type Event = z.infer<typeof Event>;
