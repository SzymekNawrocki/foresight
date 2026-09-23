import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HealthStatus } from "./HealthStatus.js";

const root = document.getElementById("root");
if (!root) throw new Error("Brak elementu #root");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <main>
        <h1>Foresight</h1>
        <HealthStatus />
      </main>
    </QueryClientProvider>
  </StrictMode>,
);
