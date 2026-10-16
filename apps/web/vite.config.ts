import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tailwind v4 nie potrzebuje PostCSS; pusty config zatrzymuje szukanie obcego postcss.config w katalogach wyżej.
  css: { postcss: {} },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
