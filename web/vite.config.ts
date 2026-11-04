import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const DEV_SERVER_PORT = 5173;
// Dev only: lets the app call the API on the same origin (`/api/v1`) without CORS.
// [ASSUMPTION] backend dev server on port 8000 until issue #2 fixes it.
const DEFAULT_API_PROXY_TARGET = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: DEV_SERVER_PORT,
    proxy: { "/api": process.env["API_PROXY_TARGET"] ?? DEFAULT_API_PROXY_TARGET },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
