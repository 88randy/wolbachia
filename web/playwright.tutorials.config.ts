import { defineConfig, devices } from "@playwright/test";

/**
 * Records the how-to tutorial clips against an already running app (QA web 5173, API 8000).
 * Run with `npm run tutorials:record [module]`. See e2e/tutorials/README.md.
 */
const MINUTE_MS = 60_000;

export default defineConfig({
  testDir: "./e2e/tutorials",
  testMatch: "**/*.rec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 2 * MINUTE_MS,
  reporter: "list",
  use: {
    baseURL: process.env["TUTORIALS_BASE_URL"] ?? "http://127.0.0.1:5173",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
