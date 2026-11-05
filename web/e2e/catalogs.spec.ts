import { expect, test } from "@playwright/test";
import { CATALOG_ADMIN } from "../src/test/catalog-fixtures";
import { mockApi } from "./fixtures/mock-api";
import { mockCatalogs } from "./fixtures/catalogs-mock";
import { expectNoAxeViolations, rememberPreferences, THEMES, LANGUAGES } from "./fixtures/a11y";

test("W63: add, edit, keyboard reorder, confirm deactivation and reactivate", async ({ page }) => {
  await mockApi(page, { me: CATALOG_ADMIN });
  await mockCatalogs(page);
  await page.goto("/settings/catalogs");
  await expect(page).toHaveURL(/\/settings\/catalogs\/intervention-type$/);
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows.last()).toContainText("Otro (especificar)");
  await page.getByRole("button", { name: "Agregar elemento" }).click();
  await page.getByLabel("Código", { exact: true }).fill("new");
  await page.getByLabel("Etiqueta en español (obligatoria)", { exact: true }).fill("Nueva");
  await page.getByLabel("Etiqueta en inglés", { exact: true }).fill("New");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  let added = page.getByRole("row", { name: /Nueva/ });
  await added.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Etiqueta en español (obligatoria)", { exact: true }).fill("Actualizada");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  added = page.getByRole("row", { name: /Actualizada/ });
  const up = added.getByRole("button", { name: "Mover arriba: Actualizada" });
  await up.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Se movió Actualizada arriba.", { exact: true })).toBeVisible();
  const down = added.getByRole("button", { name: "Mover abajo: Actualizada" });
  await down.focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Se movió Actualizada abajo.", { exact: true })).toBeVisible();
  const deactivate = added.getByRole("button", { name: "Desactivar", exact: true });
  await deactivate.click();
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(deactivate).toBeFocused();
  await deactivate.click();
  await page.getByRole("dialog").getByRole("button", { name: "Desactivar", exact: true }).click();
  await expect(added).toHaveCount(0);
  await page.getByLabel("Incluir desactivados").check();
  await expect(page).toHaveURL(/include_deactivated=true/);
  await added.getByRole("button", { name: "Reactivar", exact: true }).click();
  await expect(added).toContainText("Activo");
  await expect(rows.last()).toContainText("Otro (especificar)");
  await expectNoAxeViolations(page);
});

for (const theme of THEMES) {
  for (const language of LANGUAGES) {
    test(`W63 axe: ${theme}, ${language}, table and dialogs`, async ({ page }) => {
      await rememberPreferences(page, theme, language);
      await mockApi(page, { me: CATALOG_ADMIN });
      await mockCatalogs(page);
      await page.goto("/settings/catalogs/intervention-type");
      await expect(page.getByRole("row", { name: /spraying/ })).toBeVisible();
      await expectNoAxeViolations(page);
      await page
        .getByRole("button", {
          name: language === "en" ? "Add item" : "Agregar elemento",
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await page
        .getByRole("row", { name: /spraying/ })
        .getByRole("button", { name: language === "en" ? "Deactivate" : "Desactivar", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("dialog").getByRole("button", {
          name: language === "en" ? "Deactivate" : "Desactivar",
          exact: true,
        }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: language === "en" ? "Cancel" : "Cancelar", exact: true }),
      ).toBeFocused();
      await expectNoAxeViolations(page);
    });
  }
}
