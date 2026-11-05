import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { makeMe } from "../../src/test/fake-api";
import { makePhone } from "./devices-mock";
import { E2E_PASSWORD } from "./mock-api";
import { makeRuleParameter, makeRuleVersion } from "./rules-mock";
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

const PHONES_ME = makeMe({ permissions: ["device.read"] });
const PHONES = [
  makePhone({ label: "Teléfono 01" }),
  makePhone({ label: "Teléfono 02", is_revoked: true, last_seen_at: null }),
];

const RULES_ME = makeMe({
  permissions: [
    "rule_parameter.read",
    "rule_parameter_version.read",
    "rule_parameter_version.create",
    "rule_parameter_version.void",
  ],
});
const SPEED = "/settings/rule-parameters/speed_lock_kmh";
const RULES = [
  {
    parameter: makeRuleParameter({ key: "speed_lock_kmh", unit: "km_h" }),
    versions: [
      makeRuleVersion({ value: 10 }),
      makeRuleVersion({
        value: 8,
        effective_from: "2026-12-01T06:00:00Z",
        effective_date: "2026-12-01",
      }),
      makeRuleVersion({
        value: 12,
        effective_from: "2026-12-15T06:00:00Z",
        effective_date: "2026-12-15",
        voided_at: "2026-11-04T18:00:00Z",
        voided_by: "9d3c8a77-1b2e-4f60-a5c1-0f7e6d5c4b3a",
        void_reason: "Se capturó dos veces",
      }),
    ],
  },
  {
    parameter: makeRuleParameter({
      key: "fuel_efficiency_min_km_l",
      value_type: "decimal",
      unit: "km_l",
    }),
    versions: [],
  },
];

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
      await page.goto("/reset-password#uid=MQ&token=set-password-link");
      await expect(page.locator("#reset-new-password")).toBeVisible();
    },
  },
  {
    name: "reset password with a weak password",
    api: { me: null, resetConfirm: "too-short" },
    reach: async (page) => {
      await page.goto("/reset-password#uid=MQ&token=set-password-link");
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
      await page.goto("/reset-password#uid=MQ&token=old-link");
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
    name: "phones list",
    api: { me: PHONES_ME, devices: PHONES },
    reach: async (page) => {
      await page.goto("/settings/phones");
      await expect(page.getByRole("row", { name: /Teléfono 01/ })).toBeVisible();
    },
  },
  {
    name: "phones list with a filter and an ignored parameter",
    api: { me: PHONES_ME, devices: PHONES },
    reach: async (page) => {
      await page.goto("/settings/phones?is_revoked=true&colour=red");
      await expect(page.getByRole("row", { name: /Teléfono 02/ })).toBeVisible();
      await expect(page.locator("[role=status]").filter({ hasText: "colour" })).toBeVisible();
      await expect(
        page.getByRole("list", { name: /Filtros activos|Active filters/ }),
      ).toBeVisible();
    },
  },
  {
    name: "phones list with nothing for the filter",
    api: { me: PHONES_ME, devices: [] },
    reach: async (page) => {
      await page.goto("/settings/phones?is_revoked=true");
      await expect(
        page
          .locator("main button")
          .filter({ hasText: /Limpiar|Clear/ })
          .first(),
      ).toBeVisible();
    },
  },
  {
    name: "phones list that failed",
    api: { me: PHONES_ME, devices: PHONES },
    reach: async (page, api) => {
      api.devices.setFailing(true);
      await page.goto("/settings/phones");
      await expect(page.getByRole("alert")).toBeVisible();
    },
  },
  {
    name: "rule parameters list",
    api: { me: RULES_ME, rules: RULES },
    reach: async (page) => {
      await page.goto("/settings/rule-parameters");
      await expect(page.getByRole("row", { name: /speed_lock_kmh/ })).toBeVisible();
    },
  },
  {
    name: "rule parameter with history and voided versions",
    api: { me: RULES_ME, rules: RULES },
    reach: async (page) => {
      await page.goto(`${SPEED}?include_voided=true`);
      await expect(page.getByText(/Se capturó dos veces/)).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(3);
    },
  },
  {
    name: "rule parameter form with the comparison and a missing reason",
    api: { me: RULES_ME, rules: RULES },
    reach: async (page) => {
      await page.goto(SPEED);
      await page.locator("#rule-version-value").fill("8");
      await page.locator("#rule-version-date").fill("2026-12-20");
      await expect(page.getByRole("heading", { level: 3 })).toBeVisible();
      await page.locator("form button[type=submit]").click();
      await expect(page.locator("#rule-version-reason-error")).toBeVisible();
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
