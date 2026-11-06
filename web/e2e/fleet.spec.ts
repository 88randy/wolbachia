import { expect, test } from "./fixtures/test";
import type { Schemas } from "@wolbachia/api-client";
import { makeMe } from "../src/test/fake-api";
import { mockApi } from "./fixtures/mock-api";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";

const RECORD: Schemas["Motorcycle"] = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "M-03",
  plate: "TEST-03",
  center: null,
  revision: 0,
  is_blocked: true,
  blocked_reason: "severe_check",
  created_at: "2026-10-01T15:00:00Z",
  created_by: null,
  voided_at: null,
  voided_by: null,
  void_reason_code: "",
  void_reason: "",
};
const VIEWPORT = { width: 320, height: 700 };

for (const language of LANGUAGES) {
  for (const theme of THEMES) {
    test(`fleet keyboard journey and reflow: ${language}, ${theme}`, async ({ page }) => {
      await rememberPreferences(page, theme, language);
      await mockApi(page, {
        me: makeMe({ permissions: ["motorcycle.read", "motorcycle.manage", "motorcycle.unblock"] }),
      });
      let motorcycle = { ...RECORD };
      await page.route("**/api/v1/motorcycles/**", async (route) => {
        if (route.request().method() === "POST") {
          expect(route.request().url()).toContain(`/motorcycles/${RECORD.id}/unblock/`);
          expect(route.request().postDataJSON()).toEqual({
            reason: "Repair checked and documented",
          });
          motorcycle = { ...motorcycle, is_blocked: false, blocked_reason: "" };
          await route.fulfill({ json: motorcycle });
          return;
        }
        await route.fulfill({
          json: { count: 1, next: null, previous: null, results: [motorcycle] },
        });
      });
      await page.setViewportSize(VIEWPORT);
      await page.goto("/fleet/motorcycles?is_blocked=true");
      const code = page.getByRole("link", { name: "M-03" });
      await expect(code).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await code.focus();
      await page.keyboard.press("Enter");
      const unblock = page.getByRole("button", {
        name: language === "en" ? "Unblock" : "Desbloquear",
      });
      await expect(unblock).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
      await unblock.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      const cancel = dialog.getByRole("button", {
        name: language === "en" ? "Cancel" : "Cancelar",
        exact: true,
      });
      const confirm = dialog.getByRole("button", {
        name: language === "en" ? "Unblock" : "Desbloquear",
        exact: true,
      });
      await expect(cancel).toBeFocused();
      await expect(dialog.getByRole("combobox")).toHaveCount(0);
      const reason = dialog.getByRole("textbox");
      await expect(reason).toHaveAttribute("required", "");
      await expect(confirm).toBeDisabled();
      // Native modality must reject background focus; browser chrome is outside the page's trap.
      await page
        .getByRole("link", {
          name: language === "en" ? "Back to motorcycles" : "Volver a motos",
          includeHidden: true,
          exact: true,
        })
        .evaluate((element) => {
          element.focus();
        });
      await expect(cancel).toBeFocused();
      expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
      await page.keyboard.press("Shift+Tab");
      await expect(reason).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(cancel).toBeFocused();
      // HTML sequential navigation may leave the final control for browser chrome; test in-page neighbors.
      await page.keyboard.press("Shift+Tab");
      await expect(reason).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(unblock).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(cancel).toBeFocused();
      await expectNoAxeViolations(page);
      await page.keyboard.press("Shift+Tab");
      await expect(reason).toBeFocused();
      await reason.fill("Repair checked and documented");
      await expect(confirm).toBeEnabled();
      await page.keyboard.press("Tab");
      await expect(cancel).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(confirm).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByText(language === "en" ? "Available" : "Disponible", { exact: true }),
      ).toBeVisible();
      await expect(unblock).toBeFocused();
      await expectNoHorizontalScroll(page);
      await page
        .getByRole("link", { name: language === "en" ? "Fuel" : "Combustible", exact: true })
        .click();
      await expect(
        page.getByText(language === "en" ? "Insufficient data" : "Datos insuficientes"),
      ).toBeVisible();
      expect(new URL(page.url()).searchParams.get("is_blocked")).toBe("true");
      await expectNoHorizontalScroll(page);
    });
  }
}
