import { expect, test } from "./fixtures/test";
import type { Page } from "@playwright/test";
import type { Schemas } from "@wolbachia/api-client";
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
  let current = W64_TYPE;
  let versions: Schemas["IncidentTypeHistory"][] = [
    { ...W64_TYPE, created_at: "2026-11-01T12:00:00Z", created_by: null },
  ];
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
      await route.fulfill({ json: incidentTypePage(versions) });
      return;
    }
    if (request.method() === "PATCH") {
      const patch = request.postDataJSON() as Schemas["PatchedTypeConfigurationRequest"];
      expect(patch.expected_revision).toBe(current.revision);
      current = {
        ...current,
        close_evidence_min: patch.close_evidence_min ?? current.close_evidence_min,
        revision: current.revision + 1,
        current_version_id: "00000000-0000-4000-8000-000000000003",
      };
      versions = [
        { ...current, created_at: "2026-11-09T12:00:00Z", created_by: null },
        ...versions,
      ];
      await route.fulfill({ json: current });
      return;
    }
    await route.fulfill({
      json: incidentTypePage([current]),
    });
  });
}
async function expandText(page: Page) {
  await page.evaluate(() => {
    const root = document.querySelector("main");
    if (!root) throw new Error("Missing main content");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
for (const language of LANGUAGES) {
  for (const theme of THEMES) {
    test(`W64 keyboard, captured rules, history and phone reflow: ${language}, ${theme}`, async ({
      page,
    }, testInfo) => {
      await rememberPreferences(page, theme, language);
      await setup(page);
      await page.setViewportSize({ width: 1280, height: 900 });
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
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const versions = dialog.getByRole("listitem");
      await expect(versions).toHaveCount(2);
      await expect(versions.nth(0).locator("dd").filter({ hasText: /^3$/ })).toHaveCount(1);
      await expect(versions.nth(1).locator("dd").filter({ hasText: /^2$/ })).toHaveCount(1);
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await expect(history).toBeFocused();
      await page
        .getByRole("button", { name: language === "en" ? "Close" : "Cerrar", exact: true })
        .click();
      await expect(row).toBeFocused();
      await row.click();
      await expect(terminal).toHaveValue(W64_TYPE.terminal);
      await expect(evidence).toHaveValue("3");
      await page.getByRole("main").evaluate((main) => {
        main.scrollTop = 0;
      });
      await page.screenshot({ path: testInfo.outputPath("W64-1280.png"), fullPage: true });
      await page.setViewportSize({ width: 320, height: 800 });
      await expandText(page);
      await expectNoHorizontalScroll(page);
      await expect(save).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
}
