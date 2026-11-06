import { expect, test } from "./fixtures/test";
import type { Page } from "@playwright/test";
import { makeMe, makeOrganization } from "../src/test/fake-api";
import { mockApi } from "./fixtures/mock-api";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";
const SCOPE = {
  centers: { mode: "all" as const, ids: [] },
  quadrants: { mode: "all" as const, ids: [] },
};
const ROLE = {
  id: "role",
  slug: "custom",
  label_es: "Equipo",
  label_en: "Team",
  permissions: ["role.read", "role.update"],
  scope: SCOPE,
  revision: 1,
  is_active: true,
};
async function setupOrganizationApi(page: Page) {
  await mockApi(page, {
    me: makeMe({
      permissions: [
        "organization.read",
        "organization.update",
        "role.read",
        "role.update",
        "center.read",
      ],
      scope: SCOPE,
    }),
  });
  await page.route("**/api/v1/centers/**", (route) =>
    route.fulfill({
      json: { results: [{ id: "center", code: "C-01", name: "Center" }], count: 1, next: null },
    }),
  );
  await page.route("**/api/v1/roles/**", (route) =>
    route.fulfill({ json: { results: [ROLE], count: 1, next: null } }),
  );
  await page.route("**/api/v1/organization/", (route) =>
    route.fulfill({ json: { ...makeOrganization("norte", "Program"), revision: 1 } }),
  );
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
    test(`W-03 keyboard, focus, live results and reflow: ${language}, ${theme}`, async ({
      page,
    }) => {
      await rememberPreferences(page, theme, language);
      await setupOrganizationApi(page);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto("/settings/roles");
      const cell = page.getByRole("button", {
        name: new RegExp(`^${language === "en" ? "Team" : "Equipo"}: role.update `),
      });
      await expect(cell).toBeVisible();
      await expectNoAxeViolations(page);
      await cell.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("input").first()).toBeFocused();
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await expect(cell).toBeFocused();
      await page
        .getByRole("combobox", { name: language === "en" ? "Center filter" : "Filtro de centro" })
        .selectOption("center");
      await expect(
        page.locator("header [role=status]").filter({ hasText: /^Center$/ }),
      ).toContainText("Center");
      await page.goto("/settings/organization");
      await expect(
        page.getByRole("textbox", { name: language === "en" ? "Time zone" : "Zona horaria" }),
      ).toBeVisible();
      await expectNoAxeViolations(page);
      await expandText(page);
      await expectNoHorizontalScroll(page);
      await expect(page.locator("button[type=submit]")).toBeVisible();
    });
  }
}
