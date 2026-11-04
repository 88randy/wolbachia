import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { makeMe } from "../../src/test/fake-api";
import { E2E_PASSWORD } from "./mock-api";
import type { MockApi, MockApiOptions } from "./mock-api";

const TWO_ORGANIZATIONS = [
  { slug: "norte", name: "Región Norte" },
  { slug: "sur", name: "Región Sur" },
];

export interface Scenario {
  name: string;
  api: MockApiOptions;
  /** Brings the page to the state under test. Selectors use ids so they work in both languages. */
  reach: (page: Page, api: MockApi) => Promise<void>;
}

const SESSION_MS = 61_000; // just over how long /me/ counts as fresh (60 s)

/**
 * Opens Home, lets the session "expire" on the server and moves the clock past the freshness of
 * /me/. Coming back to the tab refetches it, which is a 401 after the user was signed in.
 */
export async function expireWhileWorking(page: Page, api: MockApi): Promise<void> {
  await page.clock.install();
  await page.goto("/");
  await page.clock.resume();
  await expect(page.getByRole("main")).toBeVisible();
  await page.locator("#global-search").fill("borrador sin guardar");
  api.expireSession();
  await page.clock.fastForward(SESSION_MS);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("visibilitychange"));
  });
}

/** Screens and states of #28 that every theme and language must render without violations. */
export const scenarios: Scenario[] = [
  {
    name: "sign-in",
    api: { me: null },
    reach: async (page) => {
      await page.goto("/login");
      await expect(page.locator("#login-username")).toBeVisible();
    },
  },
  {
    name: "sign-in with an error",
    api: { me: null, login: "invalid" },
    reach: async (page) => {
      await page.goto("/login");
      await page.locator("#login-username").fill("ana.supervisora");
      await page.locator("#login-password").fill(E2E_PASSWORD);
      await page.locator("form button[type=submit]").click();
      await expect(page.getByRole("alert")).toBeVisible();
    },
  },
  {
    name: "sign-in with a lockout",
    api: { me: null, login: "locked" },
    reach: async (page) => {
      await page.goto("/login");
      await page.locator("#login-username").fill("ana.supervisora");
      await page.locator("#login-password").fill(E2E_PASSWORD);
      await page.locator("form button[type=submit]").click();
      await expect(page.getByRole("alert")).toBeVisible();
    },
  },
  {
    name: "forgot password",
    api: { me: null },
    reach: async (page) => {
      await page.goto("/forgot-password");
      await expect(page.locator("#forgot-email")).toBeVisible();
    },
  },
  {
    name: "forgot password, sent",
    api: { me: null },
    reach: async (page) => {
      await page.goto("/forgot-password");
      await page.locator("#forgot-email").fill("ana@example.org");
      await page.locator("form button[type=submit]").click();
      await expect(page.getByRole("status")).toBeVisible();
    },
  },
  {
    name: "reset password",
    api: { me: null },
    reach: async (page) => {
      await page.goto("/reset-password/MQ/set-password-link");
      await expect(page.locator("#reset-new-password")).toBeVisible();
    },
  },
  {
    name: "reset password with a weak password",
    api: { me: null, resetConfirm: "too-short" },
    reach: async (page) => {
      await page.goto("/reset-password/MQ/set-password-link");
      await page.locator("#reset-new-password").fill(E2E_PASSWORD);
      await page.locator("#reset-confirm-password").fill(E2E_PASSWORD);
      await page.locator("form button[type=submit]").click();
      await expect(page.locator("#reset-new-password-error")).toBeVisible();
    },
  },
  {
    name: "reset password with an invalid link",
    api: { me: null, resetConfirm: "invalid-link" },
    reach: async (page) => {
      await page.goto("/reset-password/MQ/old-link");
      await page.locator("#reset-new-password").fill(E2E_PASSWORD);
      await page.locator("#reset-confirm-password").fill(E2E_PASSWORD);
      await page.locator("form button[type=submit]").click();
      await expect(page.getByRole("alert")).toBeVisible();
    },
  },
  {
    name: "organization selection",
    api: { me: makeMe({ organizations: TWO_ORGANIZATIONS }) },
    reach: async (page) => {
      await page.addInitScript(() => {
        window.localStorage.removeItem("wolbachia.organization");
      });
      await page.goto("/select-organization");
      await expect(page.getByRole("radio").first()).toBeVisible();
    },
  },
  {
    name: "no permission",
    api: { me: makeMe({ permissions: [] }) },
    reach: async (page) => {
      await page.goto("/settings");
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main").locator("dl")).toBeVisible();
    },
  },
  {
    name: "user menu open",
    api: { me: makeMe({ organizations: TWO_ORGANIZATIONS }) },
    reach: async (page) => {
      await page.addInitScript(() => {
        window.localStorage.setItem("wolbachia.organization", "norte");
      });
      await page.goto("/");
      await page.locator("button[aria-controls=user-menu-panel]").click();
      await expect(page.locator("#user-menu-panel")).toBeVisible();
    },
  },
  {
    name: "re-authentication dialog",
    api: {},
    reach: async (page, api) => {
      await expireWhileWorking(page, api);
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
];
