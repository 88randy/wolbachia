import { test, expect } from "./fixtures/test";
import type { Page } from "@playwright/test";
import type { Schemas } from "@wolbachia/api-client";
import { mockApi } from "./fixtures/mock-api";
import { makeMe } from "../src/test/fake-api";
import {
  inventoryLot,
  inventoryPage,
  INVENTORY_LOT,
  INVENTORY_CENTER,
  INVENTORY_ADMISSION,
} from "../src/test/inventory-fixtures";
import { conditionStatus, conditionReading } from "../src/inventory/conditions/test-fixtures";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";

function currentConditionReading(
  overrides: Partial<Schemas["Condition"]> = {},
): Schemas["Condition"] {
  const status = conditionStatus();
  return conditionReading({
    id: "00000000-0000-4000-8000-000000000034",
    lot_version_id: status.lot_version_id,
    range: status.protocol,
    temperature_c: "25",
    evaluation: "normal",
    ...overrides,
  });
}
function currentConditionStatus(readingId: string): Schemas["ConditionStatus"] {
  const status = conditionStatus();
  return {
    ...status,
    slots: status.slots.map((slot) =>
      slot.slot === 0 ? { ...slot, reading_id: readingId } : slot,
    ),
  };
}
async function expandStaticText(page: Page) {
  await page.getByRole("main").evaluate((main) => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);
    for (const name of Array.from(computed).filter(
      (key) => key.startsWith("--web-type-") && key.endsWith("-font-size"),
    ))
      root.style.setProperty(
        name,
        `${String(parseFloat(computed.getPropertyValue(name)) * 1.3)}px`,
      );
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (
        node.textContent?.trim() &&
        !node.parentElement?.closest(
          "script,style,a,button,label,legend,option,code,time,td,dd,output",
        )
      )
        node.textContent += ".".repeat(Math.ceil(node.textContent.length * 0.3));
    }
  });
}

for (const language of LANGUAGES)
  for (const theme of THEMES) {
    test(`W18 capture, historical chart/table and blocker navigation ${language} ${theme}`, async ({
      page,
    }, testInfo) => {
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
        route.fulfill({
          json: inventoryPage([
            inventoryLot({
              status: "blocked",
              admission_id: INVENTORY_ADMISSION,
              missing_fields: [],
            }),
          ]),
        }),
      );
      let latestReadingId = "00000000-0000-4000-8000-000000000034";
      let history = [
        currentConditionReading(),
        conditionReading({
          device_time: "2026-11-06T14:10:00Z",
          server_received_at: "2026-11-06T14:11:00Z",
        }),
      ];
      await page.route(`**/api/v1/lots/${INVENTORY_LOT}/condition-status/**`, (route) =>
        route.fulfill({ json: currentConditionStatus(latestReadingId) }),
      );
      const writes: unknown[] = [];
      await page.route(`**/api/v1/lots/${INVENTORY_LOT}/conditions/**`, (route) => {
        if (route.request().method() === "POST") {
          const observed = route.request().postDataJSON() as Schemas["ConditionWriteRequest"];
          writes.push(observed);
          expect(route.request().headers()["x-csrftoken"]).toBe("e2e-csrf");
          expect(route.request().headers()["x-organization"]).toBe("norte");
          latestReadingId = "00000000-0000-4000-8000-000000000035";
          const receivedAt = "2026-11-06T19:59:30Z";
          const saved = currentConditionReading({
            ...observed,
            id: latestReadingId,
            server_received_at: receivedAt,
            created_at: receivedAt,
          });
          history = [saved, ...history];
          return route.fulfill({ status: 201, json: saved });
        }
        return route.fulfill({ json: inventoryPage(history) });
      });
      await page.setViewportSize({ width: 1280, height: 900 });
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
      await range.press("Home");
      await range.press("ArrowRight");
      await expect(range).toBeFocused();
      await expect(range).toHaveValue("1");
      const readingTable = page.getByRole("table", {
        name: language === "en" ? "Condition history" : "Historial de condiciones",
      });
      await expect(readingTable.getByRole("row")).toHaveCount(4);
      await expect(readingTable.getByRole("cell", { name: "23", exact: true })).toHaveCount(1);
      await expect(
        page.getByRole("table", {
          name: language === "en" ? "Condition history" : "Historial de condiciones",
        }),
      ).toContainText("18–24");
      await expectNoAxeViolations(page);
      await page
        .getByRole("heading", {
          name:
            language === "en"
              ? "Readings and their historical limits"
              : "Lecturas y sus límites históricos",
          exact: true,
        })
        .evaluate((heading) => {
          heading.scrollIntoView({ block: "start" });
        });
      await page.screenshot({ path: testInfo.outputPath("W18-chart-1280.png"), fullPage: true });
      await page.getByRole("main").evaluate((main) => {
        main.scrollTop = 0;
      });
      await page.screenshot({ path: testInfo.outputPath("W18-1280.png"), fullPage: true });
      await page.setViewportSize({ width: 320, height: 800 });
      await expandStaticText(page);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await test.info().attach(`W18-${language}-${theme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      const incident = page.getByRole("link", { name: "I-010", exact: true });
      await incident.focus();
      await expect(incident).toHaveAttribute("href", "/incidents/I-010");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(incident).toBeFocused();
    });
  }
