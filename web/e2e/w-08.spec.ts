import { fileURLToPath } from "node:url";
import { expect, test } from "./fixtures/test";
import type { Page, Route } from "@playwright/test";
import { makeMe } from "../src/test/fake-api";
import { STORAGE_KEYS } from "../src/storage/safe-storage";
import { mockApi } from "./fixtures/mock-api";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";
import type { NotificationPage, Preferences } from "../src/notifications/notification-query";

const ID = "00000000-0000-4000-8000-000000000150";
const member = makeMe({
  permissions: ["notification.read", "notification_preference.update"],
  scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
});
const inbox: NotificationPage = {
  results: [
    {
      id: ID,
      kind: "incident",
      code: "incident.created",
      params: {},
      created_at: "2026-11-01T12:00:00Z",
      read_at: null,
      object_ref: { kind: "incident", available: false, id: null, code: null, is_voided: null },
    },
  ],
  next: null,
  previous: null,
  unread_total: 1,
};
const preferences: Preferences = {
  preferences: [
    { kind: "critical", in_app: true, email: true, required_in_app: true, required_email: true },
    { kind: "incident", in_app: true, email: false, required_in_app: false, required_email: false },
  ],
};

async function installInbox(page: Page) {
  await page.addInitScript((key) => {
    document.cookie = "csrftoken=e2e-csrf; path=/";
    window.localStorage.setItem(key, "norte");
  }, STORAGE_KEYS.organization);
  await mockApi(page, { me: member });
  let state = structuredClone(inbox);
  await page.route("**/api/v1/notifications/**", async (route: Route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: state });
    expect(route.request().headers()["x-organization"]).toBe("norte");
    expect(route.request().headers()["x-csrftoken"]).toBe("e2e-csrf");
    state = {
      ...state,
      unread_total: 0,
      results: state.results.map((row) => ({ ...row, read_at: row.created_at })),
    };
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/v1/me/notification-preferences/", async (route) =>
    route.fulfill({ json: preferences }),
  );
}

async function expectKeyboardReadAll(page: Page, language: (typeof LANGUAGES)[number]) {
  const isSpanish = language === "es-MX";
  const receipt = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/notifications/read-all/") &&
      response.request().method() === "POST",
  );
  const readAll = page.getByRole("button", {
    name: isSpanish ? "Marcar todas como leídas" : "Mark all as read",
  });
  await readAll.focus();
  await page.keyboard.press("Enter");
  expect((await receipt).status()).toBe(204);
  await expect(
    page.getByRole("button", {
      name: isSpanish ? "Notificaciones · Sin leer: 0" : "Notifications · Unread: 0",
    }),
  ).toBeVisible();
}

for (const theme of THEMES) {
  for (const language of LANGUAGES) {
    test(`W5 keyboard, safe reference and preferences reflow: ${theme}/${language}`, async ({
      page,
    }) => {
      await rememberPreferences(page, theme, language);
      await installInbox(page);
      await page.goto("/notifications");
      const isSpanish = language === "es-MX";
      const title = isSpanish ? "Notificaciones" : "Notifications";
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
      const bell = page.getByRole("button", {
        name: isSpanish ? "Notificaciones · Sin leer: 1" : "Notifications · Unread: 1",
      });
      await bell.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: title });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(
          isSpanish
            ? "El registro no está disponible con tu acceso actual."
            : "The record is unavailable with your current access.",
        ),
      ).toBeVisible();
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await expect(bell).toBeFocused();
      const focus = await bell.evaluate((element) => getComputedStyle(element).outlineStyle);
      expect(focus).not.toBe("none");
      const critical = page.getByRole("group", {
        name: isSpanish ? "Críticos" : "Critical",
        exact: true,
      });
      await expect(
        critical.getByRole("switch", {
          name: isSpanish ? "Correo electrónico" : "Email",
          exact: true,
        }),
      ).toBeDisabled();
      if ((theme === "light" && isSpanish) || (theme === "dark" && !isSpanish)) {
        await page.screenshot({
          path: fileURLToPath(
            new URL(`../../docs/screenshots/W05-notifications-${theme}.png`, import.meta.url),
          ),
          fullPage: true,
        });
      }
      await expectKeyboardReadAll(page, language);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.evaluate(() => {
        document
          .querySelectorAll("main button, main h1, main p, main legend")
          .forEach((element) => {
            element.childNodes.forEach((child) => {
              if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim())
                child.textContent += ` ${child.textContent.slice(0, Math.ceil(child.textContent.length * 0.3))}`;
            });
          });
      });
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
    });
  }
}
