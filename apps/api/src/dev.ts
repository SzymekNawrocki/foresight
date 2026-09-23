// Lokalny serwer deweloperski. Na AWS ten sam `app` obsłuży adapter Lambdy (plaster 01b).
import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = 8787;

serve({ fetch: app.fetch, port }, () => {
  console.log(`API: http://localhost:${port}/api/health`);
});
