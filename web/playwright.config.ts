import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${String(PORT)}`;
const IS_CI = process.env["CI"] !== undefined && process.env["CI"] !== "";
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const BUILD_TIMEOUT_MS = 180_000;

// The e2e runs against the production build served by `vite preview`, as the container does.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  reporter: IS_CI ? "github" : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: DESKTOP_VIEWPORT },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: BUILD_TIMEOUT_MS,
    env: { VITE_API_BASE_URL: "/api/v1" },
  },
});
