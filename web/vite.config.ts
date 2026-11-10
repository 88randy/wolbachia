import { mapSecurityPlugin } from "./map-security.config.ts";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const DEV_SERVER_PORT = 5173;
// Dev only: lets the app call the API on the same origin (`/api/v1`) without CORS.
// [ASSUMPTION] backend dev server on port 8000 until issue #2 fixes it.
const DEFAULT_API_PROXY_TARGET = "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss(), mapSecurityPlugin()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: DEV_SERVER_PORT,
    proxy: {
      // Keep the browser's Host: the string shorthand sets changeOrigin, which sends the target's
      // host (`api:8000` in docker compose), so Django rejects it and the CSRF Origin check fails.
      "/api": {
        target: process.env["API_PROXY_TARGET"] ?? DEFAULT_API_PROXY_TARGET,
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
