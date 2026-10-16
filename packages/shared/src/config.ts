import { z } from "zod";

// GET /api/config — public values the page needs to start the login (no secrets).
export const ConfigResponse = z.object({
  auth: z.object({ domain: z.url({ protocol: /^https$/ }), clientId: z.string().min(1).max(128) }).nullable(),
});
export type ConfigResponse = z.infer<typeof ConfigResponse>;

// GET /api/me — answers only with a valid owner token; the page uses it to confirm the login.
export const MeResponse = z.object({ signedIn: z.literal(true) });
export type MeResponse = z.infer<typeof MeResponse>;
