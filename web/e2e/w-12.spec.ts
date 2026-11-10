import { test, expect } from "./fixtures/test";
import { mockApi } from "./fixtures/mock-api";
import { makeMe } from "../src/test/fake-api";
import {
  inventoryLot,
  inventoryPage,
  INVENTORY_LOT,
  INVENTORY_CENTER,
} from "../src/test/inventory-fixtures";
import { conditionStatus, conditionReading } from "../src/inventory/conditions/test-fixtures";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";

for (const language of LANGUAGES)
  for (const theme of THEMES) {
    test(`W18 capture, historical chart/table and blocker navigation ${language} ${theme}`, async ({
      page,
    }) => {
      await rememberPreferences(page, theme, language);
      await page.addInitScript(() => {
        document.cookie = "csrftoken=e2e-csrf; path=/";
        localStorage.setItem("wolbachia.organization", "norte");
      });
      await mockApi(page, {
        me: makeMe({
          permissions: ["lot.read", "condition.create", "incident.read"],
          scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
        }),
      });
      await page.route("**/api/v1/centers/**", (route) =>
        route.fulfill({
          json: inventoryPage([{ id: INVENTORY_CENTER, code: "C-01", name: "Synthetic center" }]),
        }),
      );
      await page.route("**/api/v1/lots/?*", (route) =>
        route.fulfill({ json: inventoryPage([inventoryLot()]) }),
      );
      await page.route(`**/api/v1/lots/${INVENTORY_LOT}/condition-status/**`, (route) =>
        route.fulfill({ json: conditionStatus() }),
      );
      const writes: unknown[] = [];
      await page.route(`**/api/v1/lots/${INVENTORY_LOT}/conditions/**`, (route) => {
        if (route.request().method() === "POST") {
          writes.push(route.request().postDataJSON() as unknown);
          expect(route.request().headers()["x-csrftoken"]).toBe("e2e-csrf");
          expect(route.request().headers()["x-organization"]).toBe("norte");
          return route.fulfill({ status: 201, json: conditionReading() });
        }
        return route.fulfill({ json: inventoryPage([conditionReading()]) });
      });
      await page.goto("/inventory/lots/LOT-01/conditions");
      const instant = page.getByRole("textbox", {
        name: language === "en" ? "Date and time with zone" : "Fecha y hora con zona",
      });
      await instant.focus();
      await expect(instant).toBeFocused();
      await instant.fill("2026-11-06T08:15:00-06:00");
      await page.keyboard.press("Tab");
      await page.keyboard.type("23");
      await page.keyboard.press("Tab");
      await page.keyboard.type("65");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("status").filter({
          hasText:
            language === "en" ? "Reading saved on the server" : "Lectura guardada en el servidor",
        }),
      ).toBeVisible();
      expect(writes).toEqual([
        { device_time: "2026-11-06T08:15:00-06:00", temperature_c: "23", humidity_pct: "65" },
      ]);
      await expect(
        page.getByText(language === "en" ? /Reading missing/ : /Lectura pendiente/),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: language === "en" ? "Humidity (%)" : "Humedad (%)",
          exact: true,
        })
        .click();
      const range = page.getByRole("slider");
      await range.focus();
      await range.press("ArrowRight");
      await expect(range).toBeFocused();
      await expect(
        page.getByRole("table", {
          name: language === "en" ? "Condition history" : "Historial de condiciones",
        }),
      ).toContainText("18–24");
      await page.setViewportSize({ width: 320, height: 800 });
      await page.evaluate(() => {
        const root = document.documentElement;
        const computed = getComputedStyle(root);
        for (const name of Array.from(computed).filter(
          (key) => key.startsWith("--web-type-") && key.endsWith("-font-size"),
        ))
          root.style.setProperty(
            name,
            `${String(parseFloat(computed.getPropertyValue(name)) * 1.3)}px`,
          );
      });
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await test.info().attach(`W18-${language}-${theme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      const incident = page.getByRole("link", { name: "I-010", exact: true });
      await incident.focus();
      await expect(incident).toHaveAttribute("href", "/incidents/I-010");
    });
  }
