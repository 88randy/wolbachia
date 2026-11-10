import { expect, test } from "./fixtures/test";
import type { Page } from "@playwright/test";
import { mockApi } from "./fixtures/mock-api";
import { makeMe } from "../src/test/fake-api";
import {
  W64_TYPE,
  W64_OWNERS,
  incidentTypePage,
} from "../src/settings/incident-types/w-06-fixtures";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";
async function setup(page: Page) {
  await mockApi(page, { me: makeMe({ permissions: ["incident.manage_type"] }) });
  await page.route("**/api/v1/incident-types/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("unconfigured-items/")) {
      await route.fulfill({ json: incidentTypePage([]) });
      return;
    }
    if (url.pathname.endsWith("owner-options/")) {
      const id = url.searchParams.get("membership_id");
      await route.fulfill({
        json: incidentTypePage(W64_OWNERS.filter((owner) => !id || owner.membership_id === id)),
      });
      return;
    }
    if (url.pathname.endsWith("versions/")) {
      await route.fulfill({
        json: incidentTypePage([
          { ...W64_TYPE, created_at: "2026-11-01T12:00:00Z", created_by: null },
        ]),
      });
      return;
    }
    await route.fulfill({
      json:
        request.method() === "PATCH" ? { ...W64_TYPE, revision: 3 } : incidentTypePage([W64_TYPE]),
    });
  });
}
async function expandText(page: Page) {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent?.trim() && !node.parentElement?.closest("script,style"))
        node.textContent += ".".repeat(Math.ceil(node.textContent.length * 0.3));
    }
  });
}
for (const language of LANGUAGES) {
  for (const theme of THEMES) {
    test(`W64 keyboard, captured rules, history and phone reflow: ${language}, ${theme}`, async ({
      page,
    }) => {
      await rememberPreferences(page, theme, language);
      await setup(page);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto("/settings/incident-types");
      const row = page.getByRole("button", { name: W64_TYPE.label });
      await row.focus();
      await page.keyboard.press("Enter");
      const terminal = page.getByRole("combobox", {
        name: language === "en" ? "Terminal owner" : "Responsable terminal",
      });
      await expect(terminal).toHaveValue(W64_TYPE.terminal);
      await expectNoAxeViolations(page);
      const evidence = page.getByLabel(language === "en" ? "Photos to close" : "Fotos para cerrar");
      await evidence.focus();
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type("3");
      const save = page.getByRole("button", {
        name: language === "en" ? "Save version" : "Guardar versión",
      });
      await expect(save).not.toHaveAttribute("aria-disabled", "true");
      await save.focus();
      await page.keyboard.press("Enter");
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: language === "en" ? "Version saved" : "Versión guardada" }),
      ).toBeVisible();
      const history = page.getByRole("button", {
        name: language === "en" ? "Configuration history" : "Historial de configuración",
      });
      await history.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await expect(history).toBeFocused();
      await page
        .getByRole("button", { name: language === "en" ? "Close" : "Cerrar", exact: true })
        .click();
      await expect(row).toBeFocused();
      await row.click();
      await expect(terminal).toHaveValue(W64_TYPE.terminal);
      await expandText(page);
      await expectNoHorizontalScroll(page);
      await expect(save).toBeVisible();
    });
  }
}
